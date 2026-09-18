// ---------------------------------------------------------------------------
// Qué roles pueden abrir cada pantalla — una sola fuente.
//
// `src/lib/navegacion.ts` ya lo declara enlace por enlace, y el Sidebar lo usa
// para no dibujar lo que al usuario no le toca. Pero no dibujar un enlace no
// impide escribir la dirección: la puerta es la pantalla, y el menú es apenas
// la cortesía de no ofrecer lo que no se puede abrir.
//
// Hasta acá cada pantalla repetía su lista de roles a mano, y las dos copias
// se separaron: `npm run pantallas:por-rol` encontró cinco pantallas que el
// menú escondía y la URL abría igual, y una que el menú ofrecía y la pantalla
// rechazaba. Leer la lista de la navegación en vez de repetirla quita el lugar
// donde puede volver a pasar.
//
// El grupo de seguridad sigue siendo aparte y va DESPUÉS: `puedeRealizar` solo
// puede RESTRINGIR dentro de un módulo al que el rol ya da acceso, nunca
// ampliar. Por eso una pantalla que solo mira el grupo no está protegida: sin
// grupo asignado —el caso normal— `puedeRealizar` devuelve `true` a cualquiera.
// ---------------------------------------------------------------------------
import { MODULOS, type Enlace, type Rol } from "@/lib/navegacion";

function todosLosEnlaces(): Enlace[] {
  const enlaces: Enlace[] = [];
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces ?? []) enlaces.push(enlace);
    for (const grupo of modulo.grupos ?? []) for (const enlace of grupo.enlaces) enlaces.push(enlace);
  }
  return enlaces;
}

const ROLES_POR_PANTALLA: Map<string, Rol[] | undefined> = new Map(
  todosLosEnlaces().map((e) => [e.href, e.roles])
);

/**
 * Los roles declarados para una pantalla, o `undefined` si la navegación no
 * la restringe (la ve cualquiera con sesión).
 */
export function rolesDeLaPantalla(href: string): Rol[] | undefined {
  return ROLES_POR_PANTALLA.get(href);
}

/**
 * ¿Este rol puede abrir esta pantalla? ADMIN pasa siempre, como en el Sidebar
 * y en `requerirRol`.
 *
 * Una pantalla que no está en la navegación devuelve `true`: son las de
 * detalle (`/comercial/clientes/[id]`), que cuelgan de una que sí está y
 * llevan su propia guarda. Esto NO es la única puerta de una pantalla —el
 * grupo de seguridad se comprueba aparte y puede restringir más.
 */
export function puedeVerPantalla(rol: Rol, href: string): boolean {
  if (rol === "ADMIN") return true;
  const roles = rolesDeLaPantalla(href);
  return !roles || roles.includes(rol);
}
