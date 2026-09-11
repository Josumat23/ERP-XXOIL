import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario, requerirRol } from "@/lib/auth";
import type { Usuario } from "@/generated/prisma/client";

const COOKIE_EMPRESA_ACTIVA = "erp_empresa_activa";

// Toda la data existente antes de este cambio cuelga de empresaId="1" (el
// default de siempre en cada tabla). Este bootstrap crea esa misma fila,
// explícitamente con id="1", en la tabla Empresa nueva — así ninguna de esas
// filas históricas queda huérfana. Idempotente (igual que libroDiario() en
// contabilidad.ts): se puede llamar de más sin duplicar nada.
export async function asegurarEmpresaPrincipal(): Promise<void> {
  const existente = await prisma.empresa.findUnique({ where: { id: "1" } });
  if (existente) return;

  // Lectura directa y no el ayudante de @/lib/empresa: ese ayudante crea la
  // fila de configuración si falta, y esa fila ahora apunta por clave foránea
  // a la compañía que estamos por crear. La migración hace este mismo INSERT,
  // así que en una base migrada nunca se llega aquí; esto cubre una base nueva.
  const config = await prisma.configuracionEmpresa.findFirst({ where: { empresaId: "1" } });
  await prisma.empresa.create({
    data: {
      id: "1",
      razonSocial: config?.razonSocial ?? "Mi Empresa S.A.C.",
      ruc: config?.ruc ?? null,
      pais: "Peru",
      monedaFuncional: "PEN",
      esPrincipal: true,
    },
  });
}

// Compañía activa de la sesión (cookie propia, independiente de erp_sesion).
// Todo lo que no llama a esta función sigue operando contra "1" por defecto
// — ver la nota de alcance en el modelo Empresa del schema.
export function perteneceAEmpresaActiva(
  registro: { empresaId: string } | null,
  empresaId: string
): registro is { empresaId: string } {
  return registro?.empresaId === empresaId;
}

export function empresaSolicitadaPermitida(
  usuario: Pick<Usuario, "rol" | "empresaId">,
  empresaSolicitadaId: string | undefined
): string {
  if (usuario.rol !== "ADMIN") return usuario.empresaId;
  return empresaSolicitadaId ?? usuario.empresaId;
}

export async function obtenerEmpresaActivaId(): Promise<string> {
  const usuario = await obtenerUsuario();
  if (!usuario) return "1";

  const almacen = await cookies();
  const empresaId = empresaSolicitadaPermitida(
    usuario,
    almacen.get(COOKIE_EMPRESA_ACTIVA)?.value
  );
  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, activa: true },
    select: { id: true },
  });
  return empresa?.id ?? usuario.empresaId;
}

export async function obtenerUsuarioEmpresaActiva() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  return { ...usuario, empresaId: await obtenerEmpresaActivaId() };
}

export async function requerirRolEmpresaActiva(roles: Parameters<typeof requerirRol>[0]) {
  const auth = await requerirRol(roles);
  if ("error" in auth) return auth;
  return {
    ...auth,
    usuario: { ...auth.usuario, empresaId: await obtenerEmpresaActivaId() },
  };
}

export async function establecerEmpresaActivaId(id: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_EMPRESA_ACTIVA, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
