import type { IncomingMessage } from "http";
import { prisma } from "@/lib/prisma";
import type { Usuario } from "@/generated/prisma/client";

const COOKIE_SESION = "erp_sesion";

function extraerCookie(header: string | undefined, nombre: string): string | null {
  if (!header) return null;
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    const clave = parte.slice(0, i).trim();
    if (clave === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

// Independiente de obtenerUsuario()/cookies() de next/headers: un upgrade
// crudo de WebSocket no corre dentro de un contexto de Server Component o
// Server Action, así que hay que leer el header Cookie a mano. Solo ADMIN
// puede ver el monitoreo del servidor.
export async function autenticarSolicitudWS(
  req: IncomingMessage
): Promise<{ usuario: Usuario } | null> {
  const token = extraerCookie(req.headers.cookie, COOKIE_SESION);
  if (!token) return null;

  const sesion = await prisma.sesion.findUnique({ where: { token }, include: { usuario: true } });
  if (!sesion || sesion.expiraEn < new Date() || !sesion.usuario.activo) return null;
  if (sesion.usuario.rol !== "ADMIN") return null;

  return { usuario: sesion.usuario };
}
