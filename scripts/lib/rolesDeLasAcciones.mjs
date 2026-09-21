// ---------------------------------------------------------------------------
// ¿Alguna acción admite a un rol que no puede ni abrir la pantalla?
//
// Son dos afirmaciones distintas y las dos son legítimas:
//
//   la navegación dice QUIÉN VE la pantalla;
//   `requerirRol` dice QUIÉN PUEDE hacer la operación.
//
// Ver sin poder es normal —GERENCIA mira los descuentos por canal y no los
// edita—, así que exigir que coincidan daría falsos positivos. Lo que no tiene
// lectura razonable es lo contrario: **poder sin ver**. Una acción a la que
// llega un rol que no puede abrir la pantalla es un POST sin pantalla que lo
// respalde, y la pantalla le queda inservible a quien sí la abre.
//
// La regla es esa inclusión: los roles que una acción admite tienen que estar
// entre los que la navegación deja ver su pantalla. ADMIN pasa siempre, como
// en `requerirRol`.
//
// Resuelve las constantes del archivo (`const ROLES_RRHH = [...] as const`) y
// los `...spread`: una comprobación por texto las da por incumplidas y produce
// cinco hallazgos falsos de seis.
// ---------------------------------------------------------------------------
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

/** Rutas de `actions.ts` bajo una pantalla, relativas a la raíz. */
export function archivosDeAcciones(raiz) {
  return execFileSync("git", ["ls-files", "src/app/(app)"], { cwd: raiz, encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.endsWith("/actions.ts"));
}

/** `src/app/(app)/finanzas/propuesta-pago/actions.ts` → `/finanzas/propuesta-pago` */
export function pantallaDe(ruta) {
  return "/" + ruta.replace("src/app/(app)/", "").replace("/actions.ts", "");
}

function literalesDe(nodo, constantes) {
  const roles = [];
  if (!ts.isArrayLiteralExpression(nodo)) return roles;
  for (const el of nodo.elements) {
    if (ts.isStringLiteral(el)) roles.push(el.text);
    else if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression)) {
      roles.push(...(constantes.get(el.expression.text) ?? []));
    } else if (ts.isIdentifier(el)) {
      roles.push(...(constantes.get(el.text) ?? []));
    }
  }
  return roles;
}

/**
 * Los roles que cada `requerirRol([...])` del archivo admite, con su línea.
 * @returns {{ linea: number, roles: string[] }[]}
 */
export function rolesExigidos(raiz, ruta) {
  const texto = readFileSync(resolve(raiz, ruta), "utf8");
  const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);

  // Primero las constantes del archivo, para poder resolver los spreads.
  const constantes = new Map();
  const recogerConstantes = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let valor = n.initializer;
      // `[...] as const`
      if (ts.isAsExpression(valor)) valor = valor.expression;
      if (ts.isArrayLiteralExpression(valor)) {
        constantes.set(
          n.name.text,
          valor.elements.filter(ts.isStringLiteral).map((e) => e.text)
        );
      }
    }
    ts.forEachChild(n, recogerConstantes);
  };
  recogerConstantes(fuente);

  const exigencias = [];
  const recorrer = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      (n.expression.text === "requerirRol" || n.expression.text === "requerirRolEmpresaActiva") &&
      n.arguments.length > 0
    ) {
      exigencias.push({
        linea: fuente.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        roles: literalesDe(n.arguments[0], constantes),
      });
    }
    ts.forEachChild(n, recorrer);
  };
  recorrer(fuente);
  return exigencias;
}

/**
 * @param {{ raiz: string, rolesDePantalla: (href: string) => string[] | undefined }} entrada
 * @returns las acciones que admiten un rol que no puede abrir su pantalla
 */
export function accionesSinPantalla({ raiz, rolesDePantalla }) {
  const hallazgos = [];
  let revisados = 0;
  for (const ruta of archivosDeAcciones(raiz)) {
    const href = pantallaDe(ruta);
    const puedenVer = rolesDePantalla(href);
    // Sin roles declarados la pantalla la ve cualquiera: nada que incumplir.
    if (!puedenVer) continue;
    revisados++;
    for (const { linea, roles } of rolesExigidos(raiz, ruta)) {
      const sobran = roles.filter((r) => r !== "ADMIN" && !puedenVer.includes(r));
      if (sobran.length > 0) hallazgos.push({ ruta, href, linea, sobran, puedenVer });
    }
  }
  return { revisados, hallazgos };
}

/**
 * Lo encontrado que NO se puede arreglar sin una decisión de negocio.
 *
 * Está vacía, y la prueba exige que la lista de hallazgos sea EXACTAMENTE
 * esta: si aparece un caso nuevo, la suite se pone en rojo hasta que alguien
 * lo resuelva o lo anote acá con su motivo. Una excepción sin motivo se
 * vuelve permiso permanente.
 *
 * Hubo uno. `/finanzas/propuesta-pago` —el pago masivo a proveedores, el
 * equivalente reducido al F110 de SAP— exigía ALMACEN en su acción, copiado
 * del pago individual `registrarPagoProveedor` cuyo motor reutiliza, mientras
 * el menú declaraba la pantalla para ADMIN y GERENCIA: a Gerencia le rechazaba
 * cada envío y Almacén no llegaba a la pantalla. Quién corre el pago masivo en
 * XXOIL no se decide leyendo el código; se preguntó, y la respuesta fue que la
 * corren las dos áreas, con la aprobación de cada pago siguiendo en Gerencia
 * por el umbral que ya existe. Ver `docs/acciones-sin-pantalla.md`.
 */
export const PENDIENTES_DE_DECISION = [];
