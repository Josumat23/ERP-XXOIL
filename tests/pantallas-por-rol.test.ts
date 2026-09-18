import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MODULOS, type Enlace, type Rol } from "@/lib/navegacion";
import { puedeVerPantalla, rolesDeLaPantalla } from "@/lib/accesoPantalla";

// ---------------------------------------------------------------------------
// El menú esconde el enlace; la pantalla es la que cierra la puerta.
//
// `src/lib/navegacion.ts` declara qué roles pueden ver cada enlace, y el
// Sidebar no dibuja los demás. Pero no dibujar un enlace no impide escribir la
// dirección, y `src/lib/permisos.ts` lo dice: «el rol sigue siendo la puerta
// principal de cada pantalla».
//
// `npm run pantallas:por-rol` lo comprobó por HTTP contra la demo, con un
// usuario de cada rol, y encontró CINCO pantallas que el menú escondía y la
// URL abría igual —descuentos por canal, conciliación bancaria, proyectos,
// posiciones organizativas, devoluciones de clientes— y una, proyecciones, que
// el menú ofrecía a ALMACEN y la pantalla rechazaba: un enlace muerto.
//
// Las cinco tenían la misma forma: guardaban con `puedeRealizar(...)` y nada
// más. Esa función solo puede RESTRINGIR dentro de un módulo al que el rol ya
// da acceso — sin grupo de seguridad asignado, que es el caso normal, devuelve
// `true` a cualquiera. Ninguna de las cinco mencionaba el rol ni una vez.
//
// Lo de acá es lo que se puede comprobar sin servidor, para que no vuelva a
// separarse. Lo de punta a punta lo hace el comando.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

function todosLosEnlaces(): Enlace[] {
  const enlaces: Enlace[] = [];
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces ?? []) enlaces.push(enlace);
    for (const grupo of modulo.grupos ?? []) for (const enlace of grupo.enlaces) enlaces.push(enlace);
  }
  return enlaces;
}

const CON_ROLES = todosLosEnlaces().filter((e) => e.roles);
const archivoDe = (href: string) => `src/app/(app)${href === "/" ? "" : href}/page.tsx`;

test("cada enlace con roles declarados corresponde a una pantalla que existe", () => {
  // Una declaración sobre una ruta que ya no existe no protege nada y se
  // arrastra sin que nadie la note.
  const huerfanos = CON_ROLES.filter((e) => !existsSync(resolve(RAIZ, archivoDe(e.href))));
  assert.deepEqual(huerfanos.map((e) => e.href), []);
  assert.ok(CON_ROLES.length >= 30, `solo ${CON_ROLES.length} enlace(s) con roles declarados`);
});

test("ninguna pantalla restringida deja de mirar el rol", async () => {
  // Deliberadamente laxo: alcanza con que la pantalla MENCIONE el rol. Basta
  // para lo que se encontró —las cinco defectuosas no lo nombraban ni una vez—
  // y no se equivoca con las que lo comprueban con otro nombre de variable
  // (`/configuracion/usuarios` usa `actual.rol`, no `usuario.rol`).
  //
  // Lo que NO prueba: que mire el rol CORRECTO. Una pantalla que solo mostrara
  // el rol en pantalla pasaría. Eso lo comprueba el comando, contra el servidor.
  const ciegas: string[] = [];
  for (const enlace of CON_ROLES) {
    const fuente = await readFile(resolve(RAIZ, archivoDe(enlace.href)), "utf8");
    if (!/puedeVerPantalla|requerirRol|\.rol\b/.test(fuente)) ciegas.push(enlace.href);
  }
  assert.deepEqual(ciegas, [], "pantallas restringidas que nunca miran el rol");
});

test("las seis que se corrigieron leen los roles de la navegación", async () => {
  // Que no vuelvan a tener la lista escrita a mano: era lo que dejó a
  // proyecciones ofreciéndose en el menú y rechazando en la pantalla.
  const corregidas = [
    "/comercial/descuentos-canal",
    "/finanzas/conciliacion-bancaria",
    "/proyectos",
    "/rrhh/posiciones",
    "/logistica/devoluciones-clientes",
    "/proyecciones",
  ];
  for (const href of corregidas) {
    const fuente = await readFile(resolve(RAIZ, archivoDe(href)), "utf8");
    assert.ok(
      fuente.includes(`puedeVerPantalla(usuario.rol, "${href}")`),
      `${href} no consulta la navegación`
    );
    assert.ok(rolesDeLaPantalla(href), `${href} no declara roles en la navegación`);
  }
});

test("puedeVerPantalla respeta lo declarado", () => {
  assert.equal(puedeVerPantalla("VENTAS", "/rrhh/planilla"), false);
  assert.equal(puedeVerPantalla("GERENCIA", "/rrhh/planilla"), true);
  // ADMIN pasa siempre, igual que en el Sidebar y en `requerirRol`.
  assert.equal(puedeVerPantalla("ADMIN", "/rrhh/planilla"), true);
  // Sin roles declarados la ve cualquiera con sesión.
  assert.equal(rolesDeLaPantalla("/comercial/clientes"), undefined);
  for (const rol of ["ALMACEN", "PRODUCCION", "VENTAS", "GERENCIA"] as Rol[]) {
    assert.equal(puedeVerPantalla(rol, "/comercial/clientes"), true);
  }
  // Una pantalla de detalle no está en el menú: lleva su propia guarda.
  assert.equal(puedeVerPantalla("VENTAS", "/comercial/clientes/abc123"), true);
});

test("el comando no puede quedarse mirando el código de estado", async () => {
  // La primera versión daba 118 «pantallas abiertas sin permiso» que no
  // existían: estas páginas se transmiten en streaming, y en ese caso Next
  // emite `redirect()` como una etiqueta <meta> dentro de un cuerpo 200. El
  // cuerpo trae solo el armazón, pero el estado dice 200.
  const script = await readFile(resolve(RAIZ, "scripts/pantallas-por-rol.ts"), "utf8");
  assert.match(script, /__next-page-redirect/);
  assert.match(script, /abrio: r\.status === 200 && !redirigida/);
});

test("el comando comprueba las dos direcciones y termina en rojo", async () => {
  // Sin la segunda dirección —que lo PERMITIDO sí se abra— una aplicación que
  // redirigiera todo a todo el mundo pasaría en verde.
  const script = await readFile(resolve(RAIZ, "scripts/pantallas-por-rol.ts"), "utf8");
  assert.match(script, /!permitido && seAbrio/, "no busca lo vedado que se abre");
  assert.match(script, /permitido && !seAbrio/, "no busca lo permitido que no se abre");
  assert.match(script, /url\.pathname = "\/erp_demo"/, "no fija la base demo");
  assert.match(script, /process\.exit\(1\)/);
});
