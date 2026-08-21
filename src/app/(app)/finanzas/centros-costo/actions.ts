"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { CLAVES_RECLASIFICABLES, postearReclasificacionCosto, type ClaveControl } from "@/lib/contabilidad";
import { normalizarLineasReglaAsignacion } from "@/lib/reglasAsignacionCosto";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoCentroCosto[] = [
  "PRODUCCION",
  "VENTAS",
  "ADMINISTRACION",
  "LOGISTICA",
  "OTRO",
];

export async function crearCentroCosto(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoCentroCosto;
  const almacenId = String(formData.get("almacenId") ?? "") || null;

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (!TIPOS_VALIDOS.includes(tipo)) return { error: "Seleccione un tipo válido." };

  try {
    await prisma.centroCosto.create({ data: { codigo, nombre, tipo, almacenId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe un centro de costo con el código "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/finanzas/centros-costo");
  redirect("/finanzas/centros-costo");
}

export async function alternarActivoCentroCosto(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  await prisma.centroCosto.update({ where: { id }, data: { activo } });
  revalidatePath("/finanzas/centros-costo");
}

export async function guardarPresupuesto(
  centroCostoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  const montoPresupuestado = Number(formData.get("montoPresupuestado"));

  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: "Período inválido." };
  }
  if (!Number.isFinite(montoPresupuestado) || montoPresupuestado < 0) {
    return { error: "El monto presupuestado debe ser un número válido." };
  }

  await prisma.presupuestoCentroCosto.upsert({
    where: { centroCostoId_anio_mes: { centroCostoId, anio, mes } },
    update: { montoPresupuestado },
    create: {
      centroCostoId,
      anio,
      mes,
      montoPresupuestado,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath(`/finanzas/centros-costo/${centroCostoId}`);
  revalidatePath("/finanzas/centros-costo");
  return {};
}

export async function crearReglaAsignacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;

  const nombre = String(formData.get("nombre") ?? "").trim();
  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la regla es inválido." };
  }

  if (!nombre) return { error: "El nombre de la regla es obligatorio." };
  const lineas = normalizarLineasReglaAsignacion(lineasRaw);
  if (lineas === null) return { error: "El detalle de la regla es inválido." };
  if (lineas.length < 2) {
    return { error: "Una regla de prorrateo necesita al menos 2 centros con porcentaje." };
  }
  const suma = lineas.reduce((acc, l) => acc + l.porcentaje, 0);
  if (Math.abs(suma - 100) > 0.5) {
    return { error: `Los porcentajes deben sumar 100% (suman ${suma.toFixed(1)}%).` };
  }

  const centrosActivos = await prisma.centroCosto.count({
    where: { id: { in: lineas.map((l) => l.centroCostoId) }, activo: true },
  });
  if (centrosActivos !== lineas.length) {
    return { error: "Seleccione únicamente centros de costo activos." };
  }
  await prisma.reglaAsignacionCosto.create({
    data: {
      nombre,
      lineas: {
        create: lineas.map((l) => ({ centroCostoId: l.centroCostoId, porcentaje: l.porcentaje })),
      },
    },
  });

  revalidatePath("/finanzas/centros-costo/reglas");
  redirect("/finanzas/centros-costo/reglas");
}

export async function reclasificarCosto(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const clave = String(formData.get("clave") ?? "") as ClaveControl;
  const centroOrigenId = String(formData.get("centroOrigenId") ?? "");
  const centroDestinoId = String(formData.get("centroDestinoId") ?? "");
  const monto = Number(formData.get("monto"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!CLAVES_RECLASIFICABLES.includes(clave)) return { error: "Seleccione el tipo de gasto." };
  if (!centroOrigenId || !centroDestinoId) {
    return { error: "Seleccione el centro de origen y el de destino." };
  }
  if (centroOrigenId === centroDestinoId) {
    return { error: "El centro de origen y el de destino deben ser distintos." };
  }
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!motivo) return { error: "Indique el motivo de la reclasificación (para auditoría)." };

  const resultado = await prisma.$transaction((tx) =>
    postearReclasificacionCosto(
      tx,
      { clave, monto, centroOrigenId, centroDestinoId, motivo },
      { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
    )
  );
  if (!resultado.ok) {
    return { error: `No se pudo contabilizar la reclasificación: ${resultado.motivo}` };
  }

  revalidatePath("/finanzas/centros-costo");
  revalidatePath("/finanzas/asientos");
  redirect("/finanzas/asientos");
}

export async function alternarActivoRegla(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  await prisma.reglaAsignacionCosto.update({ where: { id }, data: { activo } });
  revalidatePath("/finanzas/centros-costo/reglas");
}

// Asigna, para una clave de control (ej. GASTO_DEPRECIACION), un centro de
// costo directo o una regla de prorrateo — nunca ambos a la vez.
export async function guardarAsignacionControl(
  clave: ClaveControl,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;

  const valor = String(formData.get("valor") ?? "");
  if (!valor) {
    await prisma.centroCostoControl.deleteMany({ where: { clave } });
    revalidatePath("/finanzas/centros-costo/reglas");
    return {};
  }

  const [tipo, id] = valor.split(":");
  const data =
    tipo === "regla"
      ? { centroCostoId: null, reglaId: id }
      : { centroCostoId: id, reglaId: null };

  await prisma.centroCostoControl.upsert({
    where: { empresaId_clave: { empresaId: "1", clave } },
    update: data,
    create: { clave, ...data },
  });

  revalidatePath("/finanzas/centros-costo/reglas");
  return {};
}
