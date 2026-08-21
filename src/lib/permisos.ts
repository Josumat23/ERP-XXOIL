import { prisma } from "@/lib/prisma";
import type { Usuario } from "@/generated/prisma/client";
import type { MODULOS } from "@/app/(app)/configuracion/grupos-seguridad/modulos";

export type ClaveModulo = (typeof MODULOS)[number]["clave"];
export async function existeGrupoSeguridadAsignable(id: string | null): Promise<boolean> {
  if (id === null) return true;
  if (!id || id.length > 64) return false;
  return Boolean(
    await prisma.grupoSeguridad.findFirst({
      where: { id, activo: true, esPredefinido: false },
      select: { id: true },
    })
  );
}

// El rol (requerirRol) sigue siendo la puerta principal de cada pantalla.
// Un grupo de seguridad personalizado asignado al usuario solo puede
// RESTRINGIR una acción de creación/edición dentro de un módulo al que el rol
// ya le da acceso — nunca amplía permisos más allá del rol. Si el usuario no
// tiene grupo asignado (el caso normal), esto no cambia nada.
export async function puedeRealizar(
  usuario: Usuario,
  modulo: ClaveModulo,
  accion: "ver" | "crear" | "editar" | "aprobar"
): Promise<boolean> {
  if (usuario.rol === "ADMIN") return true;
  if (!usuario.grupoSeguridadId) return true;

  const permiso = await prisma.permisoGrupo.findUnique({
    where: { grupoId_modulo: { grupoId: usuario.grupoSeguridadId, modulo } },
  });
  if (!permiso) return true;

  if (accion === "ver") return permiso.puedeVer;
  if (accion === "crear") return permiso.puedeCrear;
  if (accion === "editar") return permiso.puedeEditar;
  return permiso.puedeAprobar;
}
