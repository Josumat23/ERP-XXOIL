// ---------------------------------------------------------------------------
// ¿Qué server action se puede llamar sin guarda?
//
// Una server action NO es una función interna: Next.js le publica un endpoint
// POST y cualquiera con la URL puede invocarla. El proyecto lo tiene escrito
// como regla —«toda server action es un POST no confiable»— y cada acción la
// cumple a mano. A mano quiere decir que la siguiente puede no cumplirla, y
// nadie se enteraría hasta que alguien la llame.
//
// Esto lo recorre con el AST de TypeScript: encuentra las acciones —las de
// archivo y las EN LÍNEA dentro de un `<form action={...}>`, que son las
// fáciles de olvidar— y sigue el grafo de llamadas, entre archivos, hasta ver
// si alguna alcanza a autenticar y a comprobar rol o permiso.
//
// LO QUE ESTO NO PRUEBA. Comprueba que la llamada ESTÉ, no que esté bien
// puesta: una acción que autentique dentro de un `if` y siga de largo por el
// otro camino pasa esta comprobación. Detecta la ausencia, no la colocación.
// Lo demás lo cubren las pruebas de cada acción.
// ---------------------------------------------------------------------------
import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

/** Saber QUIÉN es el que llama. */
export const RAICES_AUTENTICAN = ["obtenerUsuario", "requerirRol", "requerirRolEmpresaActiva"];

/** Saber si ESE puede. `requerirRol` hace las dos cosas. */
export const RAICES_AUTORIZAN = ["requerirRol", "requerirRolEmpresaActiva", "puedeRealizar"];

/**
 * Las dos acciones que no pueden exigir sesión, porque son las que la abren y
 * la cierran. La exención se define por lo que la acción HACE, no por dónde
 * está: si al cierre de sesión se le agrega cualquier otra llamada, deja de
 * estar exenta y la comprobación vuelve a exigirle guarda.
 */
export const EXENTAS = [
  {
    motivo: "es el inicio de sesión: autenticar es lo que hace",
    aplica: (a) => a.ruta === "src/app/login/actions.ts" && a.nombre === "iniciarSesion",
  },
  {
    motivo: "es el cierre de sesión: solo borra la cookie de quien la manda",
    aplica: (a) =>
      a.llamadas.size > 0 && [...a.llamadas].every((c) => c === "cerrarSesion" || c === "redirect"),
  },
];

function tieneDirectiva(cuerpo) {
  const primera = cuerpo?.statements?.[0];
  return Boolean(
    primera &&
      ts.isExpressionStatement(primera) &&
      ts.isStringLiteral(primera.expression) &&
      primera.expression.text === "use server"
  );
}

function tieneModificador(nodo, clase) {
  return nodo.modifiers?.some((m) => m.kind === clase) ?? false;
}

function resolverModulo(raiz, desde, especificador) {
  let base;
  if (especificador.startsWith("@/")) base = join("src", especificador.slice(2));
  else if (especificador.startsWith(".")) base = join(dirname(desde), especificador);
  else return null;
  for (const sufijo of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const ruta = (base + sufijo).replace(/\\/g, "/");
    if (existsSync(resolve(raiz, ruta))) return ruta;
  }
  return null;
}

/** Lee un archivo y anota sus funciones, sus llamadas y sus importaciones. */
function leerArchivo(raiz, ruta, funciones, importaciones) {
  const texto = readFileSync(resolve(raiz, ruta), "utf8");
  const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
  const archivoEsDeAcciones = tieneDirectiva(fuente);
  const misImportaciones = new Map();
  importaciones.set(ruta, misImportaciones);

  const anotar = (nombre, nodo, cuerpo, esAccion) => {
    const llamadas = new Set();
    const recorrer = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamadas.add(n.expression.text);
      ts.forEachChild(n, recorrer);
    };
    if (cuerpo) recorrer(cuerpo);
    funciones.set(`${ruta}#${nombre}`, {
      ruta,
      nombre,
      llamadas,
      esAccion,
      linea: fuente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1,
    });
  };

  let enLinea = 0;
  const visitar = (nodo) => {
    if (ts.isImportDeclaration(nodo) && ts.isStringLiteral(nodo.moduleSpecifier)) {
      const destino = resolverModulo(raiz, ruta, nodo.moduleSpecifier.text);
      const enlaces = nodo.importClause?.namedBindings;
      if (destino && enlaces && ts.isNamedImports(enlaces)) {
        for (const el of enlaces.elements) {
          misImportaciones.set(el.name.text, {
            ruta: destino,
            nombre: (el.propertyName ?? el.name).text,
          });
        }
      }
    }

    if (ts.isFunctionDeclaration(nodo) && nodo.name) {
      const exportada = tieneModificador(nodo, ts.SyntaxKind.ExportKeyword);
      const asincrona = tieneModificador(nodo, ts.SyntaxKind.AsyncKeyword);
      anotar(
        nodo.name.text,
        nodo,
        nodo.body,
        tieneDirectiva(nodo.body) || (archivoEsDeAcciones && exportada && asincrona)
      );
    } else if (ts.isVariableStatement(nodo)) {
      const exportada = tieneModificador(nodo, ts.SyntaxKind.ExportKeyword);
      for (const d of nodo.declarationList.declarations) {
        const ini = d.initializer;
        if (!ini || !ts.isIdentifier(d.name)) continue;
        // `const x = async () => {}` y también `const x = cache(async () => {})`
        const funcion =
          ts.isArrowFunction(ini) || ts.isFunctionExpression(ini)
            ? ini
            : ts.isCallExpression(ini) &&
                ini.arguments.length === 1 &&
                (ts.isArrowFunction(ini.arguments[0]) || ts.isFunctionExpression(ini.arguments[0]))
              ? ini.arguments[0]
              : null;
        if (!funcion) continue;
        const asincrona = tieneModificador(funcion, ts.SyntaxKind.AsyncKeyword);
        const propia = ts.isBlock(funcion.body) && tieneDirectiva(funcion.body);
        anotar(
          d.name.text,
          d,
          funcion.body,
          propia || (archivoEsDeAcciones && exportada && asincrona)
        );
      }
    } else if (
      (ts.isArrowFunction(nodo) || ts.isFunctionExpression(nodo)) &&
      ts.isBlock(nodo.body) &&
      tieneDirectiva(nodo.body)
    ) {
      // Acción EN LÍNEA y sin nombre, la de `<form action={async () => {...}}>`.
      anotar(`enLinea${++enLinea}`, nodo, nodo.body, true);
    }

    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
}

/**
 * @param {{ raiz: string, archivos: string[] }} entrada rutas relativas a `raiz`
 * @returns acciones halladas, y las que no alcanzan a autenticar o a autorizar
 */
export function auditarAcciones({ raiz, archivos }) {
  const funciones = new Map();
  const importaciones = new Map();
  for (const ruta of archivos) leerArchivo(raiz, ruta, funciones, importaciones);

  const resolver = (desde, nombre) => {
    const local = `${desde}#${nombre}`;
    if (funciones.has(local)) return local;
    const importada = importaciones.get(desde)?.get(nombre);
    return importada ? `${importada.ruta}#${importada.nombre}` : null;
  };

  // Punto fijo: una función alcanza una raíz si la llama, o si llama a otra
  // que la alcanza. Atraviesa archivos por las importaciones con nombre.
  const alcanzan = (raices) => {
    const marcadas = new Set();
    for (let cambio = true; cambio; ) {
      cambio = false;
      for (const [clave, f] of funciones) {
        if (marcadas.has(clave)) continue;
        for (const llamada of f.llamadas) {
          const destino = resolver(f.ruta, llamada);
          if (raices.includes(llamada) || (destino && marcadas.has(destino))) {
            marcadas.add(clave);
            cambio = true;
            break;
          }
        }
      }
    }
    return marcadas;
  };

  const autentican = alcanzan(RAICES_AUTENTICAN);
  const autorizan = alcanzan(RAICES_AUTORIZAN);

  const acciones = [];
  const exentas = [];
  for (const [clave, f] of funciones) {
    if (!f.esAccion) continue;
    const exencion = EXENTAS.find((e) => e.aplica(f));
    if (exencion) exentas.push({ ...f, motivo: exencion.motivo });
    else acciones.push({ ...f, clave, autentica: autentican.has(clave), autoriza: autorizan.has(clave) });
  }

  return {
    acciones,
    exentas,
    sinAutenticar: acciones.filter((a) => !a.autentica),
    sinAutorizar: acciones.filter((a) => a.autentica && !a.autoriza),
  };
}

/** Los archivos versionados de `src`, que es donde viven las acciones. */
export function archivosDeFuente(raiz) {
  return execFileSync("git", ["ls-files", "src"], { cwd: raiz, encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.endsWith(".ts") || s.endsWith(".tsx"));
}
