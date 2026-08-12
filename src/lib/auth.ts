import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { $Enums, Usuario } from "@/generated/prisma/client";

const COOKIE_SESION = "erp_sesion";
const DURACION_SESION_DIAS = 7;
export const MAX_INTENTOS_LOGIN = 5;
export const VENTANA_INTENTOS_LOGIN_MS = 15 * 60 * 1000;
export const DURACION_BLOQUEO_LOGIN_MS = 15 * 60 * 1000;

type EstadoIntentosLogin = Pick<
  Usuario,
  "intentosFallidos" | "ultimoIntentoFallidoEn" | "bloqueadoHasta"
>;

export function calcularIntentoFallidoLogin(estado: EstadoIntentosLogin, ahora: Date) {
  const bloqueoAnteriorVencio =
    estado.bloqueadoHasta !== null && estado.bloqueadoHasta.getTime() <= ahora.getTime();
  const dentroDeVentana =
    !bloqueoAnteriorVencio &&
    estado.ultimoIntentoFallidoEn !== null &&
    ahora.getTime() - estado.ultimoIntentoFallidoEn.getTime() <= VENTANA_INTENTOS_LOGIN_MS;
  const intentosFallidos = dentroDeVentana ? estado.intentosFallidos + 1 : 1;
  const bloqueadoHasta =
    intentosFallidos >= MAX_INTENTOS_LOGIN
      ? new Date(ahora.getTime() + DURACION_BLOQUEO_LOGIN_MS)
      : null;

  return { intentosFallidos, ultimoIntentoFallidoEn: ahora, bloqueadoHasta };
}

export function estaBloqueadoLogin(bloqueadoHasta: Date | null, ahora: Date): boolean {
  return bloqueadoHasta !== null && bloqueadoHasta.getTime() > ahora.getTime();
}

export async function registrarIntentoFallidoLogin(usuarioId: string, ahora = new Date()) {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    const estado = calcularIntentoFallidoLogin(usuario, ahora);
    await tx.usuario.update({ where: { id: usuarioId }, data: estado });
    return estado;
  });
}

export async function reiniciarIntentosLogin(usuarioId: string): Promise<void> {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: 0, ultimoIntentoFallidoEn: null, bloqueadoHasta: null },
  });
}

export function hashPassword(password: string): string {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(password, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

// Ejecutar scrypt también cuando el usuario no existe evita que el tiempo de
// respuesta revele qué nombres de acceso están registrados.
const HASH_PASSWORD_FICTICIO = hashPassword("credencial-inexistente");

export function verificarPassword(password: string, passwordHash: string): boolean {
  const [sal, hash] = passwordHash.split(":");
  if (!sal || !hash) return false;
  const calculado = scryptSync(password, sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export function verificarPasswordUniforme(password: string, passwordHash?: string): boolean {
  const coincide = verificarPassword(password, passwordHash ?? HASH_PASSWORD_FICTICIO);
  return Boolean(passwordHash) && coincide;
}

export async function crearSesion(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + DURACION_SESION_DIAS * 24 * 60 * 60 * 1000);
  await prisma.sesion.create({ data: { token, usuarioId, expiraEn } });

  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEn,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (token) {
    await prisma.sesion.deleteMany({ where: { token } });
  }
  almacen.delete(COOKIE_SESION);
}

// cache() evita repetir la consulta dentro del mismo request
export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (!token) return null;

  const sesion = await prisma.sesion.findUnique({
    where: { token },
    include: { usuario: true },
  });
  if (!sesion || sesion.expiraEn < new Date() || !sesion.usuario.activo) return null;
  return sesion.usuario;
});

// Para usar dentro de server actions: devuelve el usuario o un error legible.
export async function requerirRol(
  roles: $Enums.RolUsuario[]
): Promise<{ usuario: Usuario } | { error: string }> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };
  if (usuario.rol !== "ADMIN" && !roles.includes(usuario.rol)) {
    return { error: "Su rol no tiene permisos para realizar esta operación." };
  }
  return { usuario };
}

export const ETIQUETA_ROL: Record<$Enums.RolUsuario, string> = {
  ADMIN: "Administrador",
  ALMACEN: "Almacén",
  PRODUCCION: "Producción",
  VENTAS: "Ventas",
  GERENCIA: "Gerencia",
};
