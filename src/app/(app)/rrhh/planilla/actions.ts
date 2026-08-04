"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { generarPlanillaMensual, generarGratificacion, generarCts } from "@/lib/planilla";

export type EstadoFormulario = { error?: string };

const ROLES_RRHH = ["GERENCIA"] as const;

export async function crearPlanillaMensual(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;

  const anio = Number(formData.get("anio") ?? 0);
  const mes = Number(formData.get("mes") ?? 0);
  if (!Number.isInteger(anio) || anio < 2020) return { error: "Año inválido." };
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { error: "Mes inválido." };

  let periodoId: string;
  try {
    const resultado = await prisma.$transaction((tx) =>
      generarPlanillaMensual(tx, { anio, mes, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre })
    );
    if (!resultado.ok) return { error: resultado.error };
    periodoId = resultado.periodoId;
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/rrhh/planilla");
  redirect(`/rrhh/planilla/${periodoId}`);
}

export async function crearGratificacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;

  const anio = Number(formData.get("anio") ?? 0);
  const mitad = String(formData.get("mitad") ?? "");
  if (!Number.isInteger(anio) || anio < 2020) return { error: "Año inválido." };
  if (mitad !== "JULIO" && mitad !== "DICIEMBRE") return { error: "Seleccione julio o diciembre." };

  let periodoId: string;
  try {
    const resultado = await prisma.$transaction((tx) =>
      generarGratificacion(tx, { anio, mitad, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre })
    );
    if (!resultado.ok) return { error: resultado.error };
    periodoId = resultado.periodoId;
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/rrhh/planilla");
  redirect(`/rrhh/planilla/${periodoId}`);
}

export async function crearCts(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;

  const anio = Number(formData.get("anio") ?? 0);
  const mitad = String(formData.get("mitad") ?? "");
  if (!Number.isInteger(anio) || anio < 2020) return { error: "Año inválido." };
  if (mitad !== "MAYO" && mitad !== "NOVIEMBRE") return { error: "Seleccione mayo o noviembre." };

  let periodoId: string;
  try {
    const resultado = await prisma.$transaction((tx) =>
      generarCts(tx, { anio, mitad, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre })
    );
    if (!resultado.ok) return { error: resultado.error };
    periodoId = resultado.periodoId;
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/rrhh/planilla");
  redirect(`/rrhh/planilla/${periodoId}`);
}
