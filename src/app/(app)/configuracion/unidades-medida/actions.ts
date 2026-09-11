"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { obtenerEmpresaActivaId, requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

export async function crearClaseUnidadMedida(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  try {
    await prisma.$transaction(async (tx) => {
      const clase = await tx.claseUnidadMedida.create({
        data: { empresaId: auth.usuario.empresaId, codigo, nombre },
      });
      await registrarAuditoriaMaestro(tx, { empresaId: clase.empresaId, entidad: "ClaseUnidadMedida", registroId: clase.id, accion: "CREAR", despues: clase, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la clase "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/configuracion/unidades-medida");
  return {};
}

export async function crearUnidadMedida(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;

  const claseId = String(formData.get("claseId") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!claseId) return { error: "Seleccione la clase de unidad." };
  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  // UnidadMedida no lleva empresaId propio: cuelga de la clase, así que la
  // compañía se comprueba sobre la clase que llega del formulario.
  const empresaId = await obtenerEmpresaActivaId();
  const clase = await prisma.claseUnidadMedida.findFirst({
    where: { id: claseId, empresaId },
    select: { id: true },
  });
  if (!clase) return { error: "La clase de unidad no pertenece a la compañía activa." };

  try {
    await prisma.$transaction(async (tx) => {
      const unidad = await tx.unidadMedida.create({ data: { claseId: clase.id, codigo, nombre } });
      await registrarAuditoriaMaestro(tx, { empresaId, entidad: "UnidadMedida", registroId: unidad.id, accion: "CREAR", despues: unidad, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la unidad "${codigo}" en esa clase.` };
    }
    throw e;
  }

  revalidatePath("/configuracion/unidades-medida");
  revalidatePath("/catalogo/productos");
  revalidatePath("/catalogo/insumos");
  return {};
}

export async function alternarActivoUnidad(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    // El id llega del navegador: la unidad solo se toca si su clase es de la
    // compañía activa.
    const antes = await tx.unidadMedida.findFirst({
      where: { id, clase: { empresaId } },
    });
    if (!antes) return;
    const despues = await tx.unidadMedida.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "UnidadMedida", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/unidades-medida");
  revalidatePath("/catalogo/productos");
  revalidatePath("/catalogo/insumos");
}
