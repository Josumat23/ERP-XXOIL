// ---------------------------------------------------------------------------
// ¿El menú esconde pantallas que la URL igual abre?
//
// `src/lib/navegacion.ts` declara, enlace por enlace, qué roles pueden verlo:
// `/rrhh/planilla` lleva `roles: ["ADMIN", "GERENCIA"]`. Eso lo usa el Sidebar
// para no dibujar el enlace. Pero no dibujar un enlace no impide escribir la
// dirección, y `src/lib/permisos.ts` dice que la puerta principal de cada
// pantalla es el rol, no el menú.
//
// Esto lo comprueba pidiendo las 108 pantallas con cada rol, por HTTP. No
// inventa ninguna regla: la declaración de la navegación ES la afirmación de
// la aplicación, y esto la contrasta contra lo que el servidor responde.
//
// Las dos direcciones importan y las dos se comprueban:
//
//   VEDADA   → tiene que NO abrirse (redirección).
//   PERMITIDA → tiene que abrirse (200).
//
// Sin la segunda, una aplicación que redirigiera todo a todo el mundo pasaría
// en verde. Es la misma trampa que una consulta que no devuelve nada.
//
// Corre contra la base DEMO y necesita el servidor levantado:
//
//   npm run dev:demo            (en otra terminal)
//   npm run pantallas:por-rol
// ---------------------------------------------------------------------------
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import { MODULOS, type Enlace, type Rol } from "../src/lib/navegacion";

// Nunca contra la base de trabajo: el nombre se fija acá.
const url = new URL(process.env.DATABASE_URL ?? "");
url.pathname = "/erp_demo";
process.env.DATABASE_URL = url.toString();

const prisma = new PrismaClient({ adapter: crearAdaptador() });
const BASE = process.env.URL_ERP ?? "http://localhost:3000";

/** ADMIN queda fuera: pasa por todas las puertas por definición. */
const ROLES: Rol[] = ["ALMACEN", "PRODUCCION", "VENTAS", "GERENCIA"];

function enlacesDeLaNavegacion(): Enlace[] {
  const enlaces: Enlace[] = [];
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces ?? []) enlaces.push(enlace);
    for (const grupo of modulo.grupos ?? []) for (const enlace of grupo.enlaces) enlaces.push(enlace);
  }
  return enlaces;
}

/** Lo que la navegación afirma para este rol. */
function puedeVerlo(enlace: Enlace, rol: Rol): boolean {
  return !enlace.roles || enlace.roles.includes(rol);
}

type Hallazgo = { rol: Rol; href: string; etiqueta: string; estado: number; destino: string | null };

/**
 * OJO CON EL 200. Una pantalla que rechaza al usuario con `redirect("/")`
 * NO responde 307 acá: estas páginas son asíncronas y se transmiten en
 * streaming, y en ese caso Next emite la redirección como una etiqueta
 * `<meta http-equiv="refresh">` dentro de un cuerpo 200 —está documentado en
 * `node_modules/next/dist/docs/.../functions/redirect.md`—. El cuerpo trae
 * solo el armazón: ni un dato de la pantalla.
 *
 * Mirar únicamente el código de estado da 118 «pantallas abiertas sin
 * permiso» que no existen. Abrirse es responder 200 SIN esa etiqueta.
 */
const MARCA_REDIRECCION = "__next-page-redirect";

async function pedir(
  href: string,
  token: string
): Promise<{ estado: number; destino: string | null; abrio: boolean }> {
  const r = await fetch(BASE + href, {
    headers: { cookie: `erp_sesion=${token}` },
    redirect: "manual",
  });
  const cuerpo = r.status === 200 ? await r.text() : "";
  const redirigida = cuerpo.includes(MARCA_REDIRECCION);
  const destino =
    r.headers.get("location") ??
    (redirigida ? (cuerpo.match(/__next-page-redirect[^>]*url=([^"']+)/)?.[1] ?? "/") : null);
  return { estado: r.status, destino, abrio: r.status === 200 && !redirigida };
}

async function main() {
  const enlaces = enlacesDeLaNavegacion();
  const abiertas: Hallazgo[] = []; // vedadas que igual se abrieron
  const cerradas: Hallazgo[] = []; // permitidas que no se abrieron

  for (const rol of ROLES) {
    const usuario = await prisma.usuario.findFirst({
      where: { rol, activo: true },
      select: { id: true, nombre: true },
    });
    if (!usuario) {
      console.error(`\nNo hay ningún usuario con rol ${rol} en la demo.`);
      process.exit(1);
    }
    const token = randomBytes(32).toString("hex");
    await prisma.sesion.create({
      data: { token, usuarioId: usuario.id, expiraEn: new Date(Date.now() + 3600000) },
    });

    const vedadas = enlaces.filter((e) => !puedeVerlo(e, rol));
    console.log(`\n${rol} (${usuario.nombre}): ${vedadas.length} vedada(s) de ${enlaces.length}\n`);

    try {
      for (const enlace of enlaces) {
        const { estado, destino, abrio: seAbrio } = await pedir(enlace.href, token);
        const permitido = puedeVerlo(enlace, rol);

        if (!permitido && seAbrio) {
          abiertas.push({ rol, href: enlace.href, etiqueta: enlace.etiqueta, estado, destino });
          console.log(`  ✖ ABRE sin permiso  ${enlace.href}`);
        } else if (permitido && !seAbrio) {
          cerradas.push({ rol, href: enlace.href, etiqueta: enlace.etiqueta, estado, destino });
          console.log(`  ✖ NO abre teniendo permiso  ${enlace.href} → ${estado} ${destino ?? ""}`);
        }
      }
    } finally {
      await prisma.sesion.deleteMany({ where: { token } });
    }
  }

  if (abiertas.length === 0 && cerradas.length === 0) {
    console.log("\n✔ Cada rol abre exactamente las pantallas que la navegación le declara.");
    return;
  }
  if (abiertas.length > 0) {
    console.error(`\n✖ ${abiertas.length} pantalla(s) que el menú esconde y la URL abre igual:`);
    for (const h of abiertas) console.error(`   ${h.rol} → ${h.href}  «${h.etiqueta}»`);
  }
  if (cerradas.length > 0) {
    console.error(`\n✖ ${cerradas.length} pantalla(s) que el menú ofrece y el servidor no abre:`);
    for (const h of cerradas) console.error(`   ${h.rol} → ${h.href}  «${h.etiqueta}» (${h.estado})`);
  }
  process.exit(1);
}

main().finally(() => prisma.$disconnect());
