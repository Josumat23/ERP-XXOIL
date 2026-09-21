import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rolesDeLaPantalla } from "@/lib/accesoPantalla";
import {
  accionesSinPantalla,
  pantallaDe,
  rolesExigidos,
  PENDIENTES_DE_DECISION,
} from "../scripts/lib/rolesDeLasAcciones.mjs";

// ---------------------------------------------------------------------------
// Poder sin ver.
//
// La navegación dice QUIÉN VE una pantalla; `requerirRol` dice QUIÉN PUEDE
// hacer la operación. Son dos afirmaciones distintas y las dos son legítimas:
// ver sin poder es normal —GERENCIA mira los descuentos por canal y no los
// edita—, así que exigir que coincidan daría falsos positivos.
//
// Lo que no tiene lectura razonable es lo contrario. Una acción a la que llega
// un rol que no puede abrir la pantalla es un POST sin pantalla que lo
// respalde, y a la vez deja la pantalla inservible para quien sí la abre.
//
// De 27 archivos de acciones bajo una pantalla restringida, hay UNO así, y no
// se puede resolver sin una decisión de negocio: está en
// PENDIENTES_DE_DECISION, con el motivo. Esta prueba exige que esa lista sea
// EXACTA — si aparece otro caso, o si este se resuelve y no se saca de ahí,
// acá se pone en rojo. Una excepción que nadie vuelve a mirar es peor que no
// tener la comprobación.
// ---------------------------------------------------------------------------

const raiz = process.cwd();
const real = accionesSinPantalla({ raiz, rolesDePantalla: rolesDeLaPantalla });

async function auditarFicticios(archivos: Record<string, string>, roles: Record<string, string[]>) {
  const dir = await mkdtemp(join(tmpdir(), "sinpantalla-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    await mkdir(join(dir, ruta, ".."), { recursive: true });
    await writeFile(join(dir, ruta), contenido, "utf8");
  }
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return accionesSinPantalla({ raiz: dir, rolesDePantalla: (href: string) => roles[href] });
}

test("ninguna acción admite un rol que no puede abrir su pantalla", () => {
  // La lista de hallazgos tiene que ser EXACTAMENTE la de pendientes, que hoy
  // está vacía: un caso nuevo pone la suite en rojo hasta que se resuelva o se
  // anote con su motivo.
  assert.deepEqual(
    real.hallazgos.map(
      (h: { ruta: string; linea: number; sobran: string[] }) =>
        `${h.ruta}:${h.linea} [${h.sobran.join(", ")}]`
    ),
    PENDIENTES_DE_DECISION.map((p: { href: string }) => p.href)
  );
  // Con las dos listas vacías, esto es lo único que separa «no hay nada» de
  // «no está mirando nada». Las pruebas con archivos de mentira, más abajo,
  // son las que prueban que sea capaz de encontrar algo.
  assert.ok(real.revisados >= 20, `solo ${real.revisados} archivo(s) revisado(s)`);
});

test("el pago masivo lo corren Almacén y Gerencia, y la aprobación sigue aparte", () => {
  // Decisión de negocio tomada el 2026-09-20, no deducida del código: la
  // corrida de pagos la hacen las dos áreas y la APROBACIÓN de cada pago sigue
  // siendo de Gerencia, por el umbral que ya existe. Antes la acción pedía
  // ALMACEN y el menú mostraba la pantalla a ADMIN y GERENCIA, así que a
  // Gerencia le rechazaba cada envío y Almacén no llegaba a la pantalla.
  const puedenVer = rolesDeLaPantalla("/finanzas/propuesta-pago");
  assert.deepEqual(puedenVer, ["ADMIN", "GERENCIA", "ALMACEN"]);

  const exigencias = rolesExigidos(
    raiz,
    "src/app/(app)/finanzas/propuesta-pago/actions.ts"
  ) as { roles: string[] }[];
  assert.deepEqual(exigencias.map((e) => e.roles), [["ALMACEN", "GERENCIA"]]);

  // Y que la aprobación no se haya aflojado de paso.
  const aprobacion = rolesExigidos(
    raiz,
    "src/app/(app)/finanzas/cuentas-por-pagar/actions.ts"
  ) as { roles: string[] }[];
  assert.ok(
    aprobacion.some((e) => e.roles.length === 1 && e.roles[0] === "GERENCIA"),
    "aprobar un pago dejó de ser exclusivo de Gerencia"
  );
});

test("ver sin poder no es un hallazgo", () => {
  // GERENCIA ve los descuentos por canal y la acción pide VENTAS: correcto, y
  // marcarlo sería el falso positivo que haría ignorar la comprobación.
  assert.ok(rolesDeLaPantalla("/comercial/descuentos-canal")?.includes("GERENCIA"));
  assert.equal(
    real.hallazgos.some((h: { href: string }) => h.href === "/comercial/descuentos-canal"),
    false
  );
});

test("resuelve las constantes del archivo y los spread", async () => {
  // Una comprobación por texto da `[...ROLES_RRHH]` por incumplido y produce
  // cinco hallazgos falsos de seis. Medido: eso pasó en la primera versión.
  const dir = await mkdtemp(join(tmpdir(), "roles-"));
  await writeFile(
    join(dir, "actions.ts"),
    `const ROLES_RRHH = ["GERENCIA"] as const;\n` +
      `export async function x() { const a = await requerirRol([...ROLES_RRHH]); }\n` +
      `export async function y() { const a = await requerirRol(["ALMACEN", "VENTAS"]); }\n`,
    "utf8"
  );
  const exigencias = rolesExigidos(dir, "actions.ts") as { roles: string[] }[];
  assert.deepEqual(exigencias.map((e) => e.roles), [["GERENCIA"], ["ALMACEN", "VENTAS"]]);
});

test("la ruta del archivo da la pantalla", () => {
  assert.equal(
    pantallaDe("src/app/(app)/finanzas/propuesta-pago/actions.ts"),
    "/finanzas/propuesta-pago"
  );
});

test("detecta una acción que admite un rol que no puede abrir la pantalla", async () => {
  const sucia = await auditarFicticios(
    {
      "src/app/(app)/finanzas/caja/actions.ts":
        `"use server";\nexport async function pagar() { const a = await requerirRol(["ALMACEN"]); }\n`,
    },
    { "/finanzas/caja": ["ADMIN", "GERENCIA"] }
  );
  assert.equal(sucia.hallazgos.length, 1);
  assert.deepEqual(sucia.hallazgos[0].sobran, ["ALMACEN"]);
});

test("no marca lo que la pantalla sí deja ver, ni a ADMIN", async () => {
  const limpia = await auditarFicticios(
    {
      "src/app/(app)/finanzas/caja/actions.ts":
        `"use server";\nexport async function pagar() { const a = await requerirRol(["ADMIN", "GERENCIA"]); }\n`,
      // Sin roles declarados la pantalla la ve cualquiera: nada que incumplir.
      "src/app/(app)/comercial/pedidos/actions.ts":
        `"use server";\nexport async function crear() { const a = await requerirRol(["VENTAS"]); }\n`,
    },
    { "/finanzas/caja": ["ADMIN", "GERENCIA"] }
  );
  assert.deepEqual(limpia.hallazgos, []);
  assert.equal(limpia.revisados, 1, "contó pantallas sin roles declarados");
});

test("cada pendiente dice por qué lo está", () => {
  // Una excepción sin motivo se vuelve permiso permanente.
  for (const p of PENDIENTES_DE_DECISION as { href: string; motivo: string }[]) {
    assert.ok(p.motivo && p.motivo.length > 20, `${p.href} no dice qué decisión falta`);
  }
});
