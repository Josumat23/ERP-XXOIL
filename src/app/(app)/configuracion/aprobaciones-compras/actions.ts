"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { validarNivelesCompra } from "@/lib/aprobacionesCompra";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
export type EstadoNivel = { error?: string };

export async function crearNivelCompra(_estado: EstadoNivel, formData: FormData): Promise<EstadoNivel> {
  const auth = await requerirRol([]); if ("error" in auth) return auth;
  if (auth.usuario.rol !== "ADMIN" || !(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return { error: "No tiene permiso para configurar niveles." };
  const empresaId = await obtenerEmpresaActivaId();
  const nivel = { orden: Number(formData.get("orden")), nombre: String(formData.get("nombre") ?? "").trim(), montoDesdePen: Number(formData.get("montoDesdePen")), rolAprobador: String(formData.get("rolAprobador")) as "GERENCIA" | "ADMIN" };
  if (!validarNivelesCompra([nivel])) return { error: "Complete un nivel válido." };

  // La planta llega del formulario: se relee acotada a la compañía activa.
  const almacenId = String(formData.get("almacenId") ?? "").trim() || null;
  if (almacenId) {
    const planta = await prisma.almacen.findFirst({
      where: { id: almacenId, empresaId, activo: true },
      select: { id: true },
    });
    if (!planta) return { error: "La planta no pertenece a la compañía activa." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const creado = await tx.nivelAprobacionCompra.create({ data: { ...nivel, empresaId, almacenId } });
      await registrarAuditoriaMaestro(tx, { empresaId, entidad: "NivelAprobacionCompra", registroId: creado.id, accion: "CREAR", despues: creado, usuario: auth.usuario });
    });
  }
  catch { return { error: "El orden ya existe o el nivel no pudo guardarse." }; }
  revalidatePath("/configuracion/aprobaciones-compras"); return {};
}

export async function desactivarNivelCompra(id: string): Promise<void> {
  const auth = await requerirRol([]); if ("error" in auth || auth.usuario.rol !== "ADMIN") return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.nivelAprobacionCompra.findFirst({ where: { id, empresaId } });
    if (!antes) return;
    const despues = await tx.nivelAprobacionCompra.update({ where: { id }, data: { activo: false } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "NivelAprobacionCompra", registroId: id, accion: "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/aprobaciones-compras");
}
