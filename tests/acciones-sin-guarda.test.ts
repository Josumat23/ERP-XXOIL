import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditarAcciones, archivosDeFuente, EXENTAS } from "../scripts/lib/guardasDeAcciones.mjs";

// ---------------------------------------------------------------------------
// Toda server action es un endpoint POST público.
//
// La regla del proyecto es que ninguna confíe en quien la llama, y cada acción
// la cumple A MANO: llama a `requerirRol` o a `obtenerUsuario` y comprueba el
// permiso. A mano quiere decir que la siguiente puede no cumplirla —sobre todo
// las EN LÍNEA, las de `<form action={async () => {...}}>`, que no se ven en
// ningún `actions.ts` y son 70 de las 358—, y nadie se enteraría hasta que
// alguien las llamara.
//
// La auditoría recorre el AST y sigue el grafo de llamadas entre archivos. Lo
// primero que hay que probar de una comprobación así no es que dé verde: es
// que sea CAPAZ de dar rojo. Por eso la mitad de lo que sigue la corre contra
// archivos de mentira con el defecto puesto a propósito.
//
// Lo que NO prueba: que la guarda esté bien COLOCADA. Una acción que autentique
// dentro de un `if` y siga de largo por el otro camino pasa esto. Detecta la
// ausencia, no la colocación.
// ---------------------------------------------------------------------------

type Accion = { ruta: string; nombre: string; linea: number };
type Auditoria = {
  acciones: Accion[];
  exentas: (Accion & { motivo: string })[];
  sinAutenticar: Accion[];
  sinAutorizar: Accion[];
};

const raiz = process.cwd();
const real: Auditoria = auditarAcciones({ raiz, archivos: archivosDeFuente(raiz) });

/** Escribe archivos sueltos en un directorio temporal y los audita. */
async function auditarFicticios(archivos: Record<string, string>): Promise<Auditoria> {
  const dir = await mkdtemp(join(tmpdir(), "guardas-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(dir, ruta);
    await mkdir(join(destino, ".."), { recursive: true });
    await writeFile(destino, contenido, "utf8");
  }
  return auditarAcciones({ raiz: dir, archivos: Object.keys(archivos) });
}

const CON_GUARDA = `"use server";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
export async function borrarTodo(id: string) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  await prisma.cosa.delete({ where: { id } });
}
`;

test("ninguna server action del repositorio se puede llamar sin guarda", () => {
  assert.deepEqual(
    real.sinAutenticar.map((a) => `${a.ruta}:${a.linea} ${a.nombre}`),
    [],
    "hay acciones que no llegan a saber quién las llama"
  );
  assert.deepEqual(
    real.sinAutorizar.map((a) => `${a.ruta}:${a.linea} ${a.nombre}`),
    [],
    "hay acciones que autentican pero no comprueban rol ni permiso"
  );
});

test("la auditoría está mirando todas las acciones, no unas pocas", () => {
  // Si una refactorización dejara de reconocer las acciones, lo de arriba
  // daría verde por no encontrar nada. Al 2026-09-18 eran 358.
  assert.ok(real.acciones.length > 300, `solo encontró ${real.acciones.length} acción(es)`);
  const enLinea = real.acciones.filter((a) => a.nombre.startsWith("enLinea"));
  assert.ok(enLinea.length > 50, `solo encontró ${enLinea.length} acción(es) en línea`);
  assert.equal(real.exentas.length, 2, "las únicas exentas son abrir y cerrar sesión");
});

test("detecta una acción de archivo sin guarda", async () => {
  const sucia = await auditarFicticios({
    "src/app/x/actions.ts": `"use server";
export async function borrarTodo(id: string) {
  await prisma.cosa.delete({ where: { id } });
}
`,
  });
  assert.deepEqual(sucia.sinAutenticar.map((a) => a.nombre), ["borrarTodo"]);
});

test("detecta una acción EN LÍNEA sin guarda", async () => {
  // La que no aparece en ningún `actions.ts`.
  const sucia = await auditarFicticios({
    "src/app/x/page.tsx": `export default function Pagina() {
  return (
    <form action={async () => {
      "use server";
      await prisma.cosa.deleteMany({});
    }}>
      <button type="submit">Borrar</button>
    </form>
  );
}
`,
  });
  assert.equal(sucia.sinAutenticar.length, 1, "no vio la acción en línea");
  assert.match(sucia.sinAutenticar[0].nombre, /^enLinea/);
});

test("no marca la que se guarda a través de un ayudante local", async () => {
  // El caso de `transportistas/actions.ts`: un `autorizar()` privado que hacen
  // todas. Marcarlo sería el falso positivo que haría ignorar la comprobación.
  const limpia = await auditarFicticios({
    "src/app/x/actions.ts": `"use server";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
async function autorizar() {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return { error: "no" };
  return auth;
}
export async function borrarTodo(id: string) {
  const auth = await autorizar();
  if ("error" in auth) return auth;
  await prisma.cosa.delete({ where: { id } });
}
`,
  });
  assert.deepEqual(limpia.sinAutenticar, []);
  assert.deepEqual(limpia.sinAutorizar, []);
});

test("sigue la guarda hasta otro archivo", async () => {
  // Las acciones en línea delegan en el `actions.ts` de al lado: si la
  // auditoría no cruzara archivos, las 70 saldrían en rojo.
  const limpia = await auditarFicticios({
    "src/app/x/actions.ts": CON_GUARDA,
    "src/app/x/page.tsx": `import { borrarTodo } from "./actions";
export default function Pagina() {
  return (
    <form action={async () => {
      "use server";
      await borrarTodo("1");
    }}>
      <button type="submit">Borrar</button>
    </form>
  );
}
`,
  });
  assert.deepEqual(limpia.sinAutenticar, []);
});

test("autenticar no alcanza: también tiene que comprobar rol o permiso", async () => {
  const floja = await auditarFicticios({
    "src/app/x/actions.ts": `"use server";
import { obtenerUsuario } from "@/lib/auth";
export async function borrarTodo(id: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  await prisma.cosa.delete({ where: { id } });
}
`,
  });
  assert.deepEqual(floja.sinAutenticar, []);
  assert.deepEqual(floja.sinAutorizar.map((a) => a.nombre), ["borrarTodo"]);
});

test("la exención del cierre de sesión se define por lo que hace, no por dónde está", async () => {
  // Cerrar sesión solo borra la cookie de quien la manda; por eso no exige
  // sesión. Pero la exención mira sus llamadas: si se le agrega cualquier otra
  // cosa, deja de aplicar. Una exención por archivo y línea se quedaría
  // tapando lo que viniera después.
  const cierre = EXENTAS[1] as { aplica: (a: { llamadas: Set<string> }) => boolean };
  assert.equal(cierre.aplica({ llamadas: new Set(["cerrarSesion", "redirect"]) }), true);
  assert.equal(cierre.aplica({ llamadas: new Set(["cerrarSesion", "borrarCliente"]) }), false);
  assert.equal(cierre.aplica({ llamadas: new Set() }), false);
});

test("el comando termina en rojo cuando encuentra algo", async () => {
  // Una comprobación que informa y sale en verde no es una comprobación. Se
  // corre el comando de verdad, en un repositorio de mentira con el defecto.
  const dir = await mkdtemp(join(tmpdir(), "guardas-cli-"));
  await mkdir(join(dir, "src/app/x"), { recursive: true });
  await writeFile(
    join(dir, "src/app/x/actions.ts"),
    `"use server";\nexport async function borrarTodo(id: string) {\n  await prisma.cosa.delete({ where: { id } });\n}\n`,
    "utf8"
  );
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });

  let salida = 0;
  let texto = "";
  try {
    execFileSync(process.execPath, [join(raiz, "scripts/acciones-sin-guarda.mjs")], {
      cwd: dir,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (e) {
    const err = e as { status: number; stderr: string };
    salida = err.status;
    texto = err.stderr;
  }
  assert.equal(salida, 1, "el comando encontró el defecto y aun así salió en verde");
  assert.match(texto, /borrarTodo/);
});
