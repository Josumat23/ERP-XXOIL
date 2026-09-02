"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, TipoCentroTrabajo } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import {
  esCapacidadCentroTrabajoValida,
  normalizarCodigoCentroTrabajo,
  TIPOS_CENTRO_TRABAJO,
} from "@/lib/centrosTrabajo";

export type EstadoFormulario = { error?: string };

function leerFormulario(formData: FormData) {
  const codigo = normalizarCodigoCentroTrabajo(formData.get("codigo"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "");
  const tipo = TIPOS_CENTRO_TRABAJO.find((valor) => valor === tipoRaw);
  const almacenId = String(formData.get("almacenId") ?? "");
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const capacidadHorasDia = Number(formData.get("capacidadHorasDia"));
  const eficienciaPct = Number(formData.get("eficienciaPct"));
  if (!codigo) return { error: "El código debe tener 2 a 20 caracteres: letras, números, guion o guion bajo." } as const;
  if (!nombre) return { error: "El nombre es obligatorio." } as const;
  if (!tipo) return { error: "Seleccione un tipo de centro de trabajo válido." } as const;
  if (!almacenId) return { error: "Seleccione la planta o almacén." } as const;
  if (!esCapacidadCentroTrabajoValida(capacidadHorasDia, eficienciaPct)) {
    return { error: "La capacidad debe ser mayor a 0 y hasta 24 h/día; la eficiencia, mayor a 0 y hasta 100 %." } as const;
  }
  return { codigo, nombre, tipo, almacenId, centroCostoId, capacidadHorasDia, eficienciaPct };
}

async function validarDimensiones(almacenId: string, centroCostoId: string | null) {
  const [almacen, centro] = await Promise.all([
    prisma.almacen.findFirst({ where: { id: almacenId, activo: true } }),
    centroCostoId ? prisma.centroCosto.findFirst({ where: { id: centroCostoId, activo: true } }) : null,
  ]);
  if (!almacen) return "La planta seleccionada no existe o está inactiva.";
  if (centroCostoId && !centro) return "El centro de costo no existe o está inactivo.";
  if (centro && centro.empresaId !== almacen.empresaId) return "La planta y el centro de costo pertenecen a compañías distintas.";
  return null;
}

export async function crearCentroTrabajo(_prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) return { error: "Sin permiso para crear centros de trabajo." };
  const datos = leerFormulario(formData);
  if ("error" in datos) return datos;
  const errorDimension = await validarDimensiones(datos.almacenId, datos.centroCostoId);
  if (errorDimension) return { error: errorDimension };
  try {
    await prisma.$transaction(async (tx) => {
      const centro = await tx.centroTrabajo.create({ data: datos });
      await registrarAuditoriaMaestro(tx, { entidad: "CentroTrabajo", registroId: centro.id, accion: "CREAR", despues: centro, usuario: auth.usuario });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "El código ya existe." };
    throw error;
  }
  revalidatePath("/produccion/centros-trabajo");
  redirect("/produccion/centros-trabajo");
}

export async function actualizarCentroTrabajo(id: string, _prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return { error: "Sin permiso para editar centros de trabajo." };
  const datos = leerFormulario(formData);
  if ("error" in datos) return datos;
  const errorDimension = await validarDimensiones(datos.almacenId, datos.centroCostoId);
  if (errorDimension) return { error: errorDimension };
  try {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.centroTrabajo.findUniqueOrThrow({ where: { id } });
      const despues = await tx.centroTrabajo.update({ where: { id }, data: datos });
      await registrarAuditoriaMaestro(tx, { entidad: "CentroTrabajo", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "El código ya existe." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { error: "El centro de trabajo no existe." };
    throw error;
  }
  revalidatePath("/produccion/centros-trabajo");
  revalidatePath(`/produccion/centros-trabajo/${id}`);
  return {};
}

export async function alternarCentroTrabajo(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth || !(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.centroTrabajo.findUniqueOrThrow({ where: { id } });
    const despues = await tx.centroTrabajo.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "CentroTrabajo", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/produccion/centros-trabajo");
  revalidatePath(`/produccion/centros-trabajo/${id}`);
}

export type { TipoCentroTrabajo };
