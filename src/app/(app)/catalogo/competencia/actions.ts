"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  MENSAJE_ERROR_EQUIVALENCIA,
  coberturaEspecificaciones,
  validarEquivalencia,
} from "@/lib/equivalencias";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearProductoCompetencia(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const marca = String(formData.get("marca") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const fuente = String(formData.get("fuente") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  if (!marca || !nombre) return { error: "La marca y el nombre del producto son obligatorios." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.productoCompetencia.create({
        data: { empresaId, marca, nombre, fuente, notas },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "ProductoCompetencia",
        registroId: registro.id,
        accion: "CREAR",
        despues: registro,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `${marca} ${nombre} ya está en el catálogo de competencia.` };
    }
    throw e;
  }

  revalidatePath("/catalogo/competencia");
  return { ok: true };
}

/** Lo que la ficha del competidor dice que cumple. */
export async function agregarEspecificacionCompetencia(
  productoCompetenciaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }
  const especificacionId = String(formData.get("especificacionId") ?? "").trim();
  if (!especificacionId) return { error: "Seleccione la especificación." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // Ni el competidor ni la especificación se toman del formulario sin
      // comprobar que son de la compañía activa.
      const competidor = await tx.productoCompetencia.findFirst({
        where: { id: productoCompetenciaId, empresaId },
        select: { id: true },
      });
      if (!competidor) throw new Error("El producto de la competencia no pertenece a la empresa activa.");
      const especificacion = await tx.especificacionTecnica.findFirst({
        where: { id: especificacionId, empresaId, activo: true },
        select: { id: true },
      });
      if (!especificacion) throw new Error("La especificación no pertenece a la empresa activa o está inactiva.");
      await tx.especificacionCompetencia.create({
        data: { empresaId, productoCompetenciaId, especificacionId },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese producto ya declara esa especificación." };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/catalogo/competencia/${productoCompetenciaId}`);
  return {};
}

export async function quitarEspecificacionCompetencia(productoCompetenciaId: string, id: string) {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.especificacionCompetencia.deleteMany({
    where: { id, empresaId, productoCompetenciaId },
  });
  revalidatePath(`/catalogo/competencia/${productoCompetenciaId}`);
}

/**
 * Declara que un producto propio reemplaza a uno de la competencia.
 *
 * La cobertura la calcula el sistema; la equivalencia la declara la persona. Si
 * la cobertura no es total, la justificación es obligatoria — no se prohíbe
 * declararla, se exige que la razón quede escrita y con nombre.
 */
export async function declararEquivalencia(
  productoCompetenciaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }
  const productoId = String(formData.get("productoId") ?? "").trim();
  const justificacion = String(formData.get("justificacion") ?? "").trim() || null;
  if (!productoId) return { error: "Seleccione el producto propio." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const competidor = await tx.productoCompetencia.findFirst({
        where: { id: productoCompetenciaId, empresaId },
        include: { especificaciones: { select: { especificacionId: true } } },
      });
      if (!competidor) throw new Error("El producto de la competencia no pertenece a la empresa activa.");
      const producto = await tx.producto.findFirst({
        where: { id: productoId, empresaId },
        include: {
          especificaciones: {
            select: { especificacionId: true, tipo: true, vigenteHasta: true },
          },
        },
      });
      if (!producto) throw new Error("El producto no pertenece a la empresa activa.");

      const cobertura = coberturaEspecificaciones(
        producto.especificaciones,
        competidor.especificaciones
      );
      const error = validarEquivalencia(cobertura, justificacion);
      if (error) throw new Error(MENSAJE_ERROR_EQUIVALENCIA[error]);

      const registro = await tx.equivalenciaProducto.create({
        data: {
          empresaId,
          productoId,
          productoCompetenciaId,
          justificacion,
          cubiertasAlDeclarar: cobertura.cubiertas.length,
          totalAlDeclarar: cobertura.total,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "EquivalenciaProducto",
        registroId: registro.id,
        accion: "CREAR",
        despues: registro,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese producto ya está declarado como equivalente." };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/catalogo/competencia/${productoCompetenciaId}`);
  return {};
}

export async function quitarEquivalencia(productoCompetenciaId: string, id: string) {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.equivalenciaProducto.findFirst({
      where: { id, empresaId, productoCompetenciaId },
    });
    if (!antes) return;
    await tx.equivalenciaProducto.delete({ where: { id } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "EquivalenciaProducto",
      registroId: id,
      accion: "ELIMINAR",
      antes,
      usuario: auth.usuario,
    });
  });
  revalidatePath(`/catalogo/competencia/${productoCompetenciaId}`);
}
