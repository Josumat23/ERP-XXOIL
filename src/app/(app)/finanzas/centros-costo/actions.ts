"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { esPeriodoMensualValido } from "@/lib/periodos";
import { CLAVES_RECLASIFICABLES, postearReclasificacionCosto, type ClaveControl } from "@/lib/contabilidad";
import {
  esClaveControlValida,
  normalizarDestinoControlCosto,
  normalizarLineasReglaAsignacion,
} from "@/lib/reglasAsignacionCosto";
import { creariaCicloCentroCosto } from "@/lib/jerarquiaCentrosCosto";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

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
  const empresaId = await obtenerEmpresaActivaId();

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoCentroCosto;
  const almacenId = String(formData.get("almacenId") ?? "") || null;
  const parentId = String(formData.get("parentId") ?? "") || null;

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (!TIPOS_VALIDOS.includes(tipo)) return { error: "Seleccione un tipo válido." };

  if (almacenId) {
    const almacen = await prisma.almacen.findFirst({
      where: { id: almacenId, empresaId },
      select: { id: true },
    });
    if (!almacen) return { error: "El almacén no existe en la compañía activa." };
  }

  if (parentId) {
    const parent = await prisma.centroCosto.findFirst({
      where: { id: parentId, empresaId },
      select: { id: true },
    });
    if (!parent) return { error: "El centro superior no existe en la compañía activa." };
  }

  try {
    await prisma.centroCosto.create({ data: { empresaId, codigo, nombre, tipo, almacenId, parentId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe un centro de costo con el código "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/finanzas/centros-costo");
  redirect("/finanzas/centros-costo");
}

export async function guardarPadreCentroCosto(
  centroId: string,
  _prevState: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const parentId = String(formData.get("parentId") ?? "") || null;

  const error = await prisma.$transaction(async (tx) => {
    const centros = await tx.centroCosto.findMany({
      where: { empresaId },
      select: { id: true, parentId: true },
    });
    if (!centros.some((centro) => centro.id === centroId)) {
      return "El centro de costo no existe en la compañía activa.";
    }
    if (parentId && !centros.some((centro) => centro.id === parentId)) {
      return "El centro superior no existe en la compañía activa.";
    }
    if (creariaCicloCentroCosto(centroId, parentId, centros)) {
      return "La jerarquía no puede contener ciclos ni autorreferencias.";
    }
    await tx.centroCosto.update({ where: { id: centroId }, data: { parentId } });
    return null;
  });
  if (error) return { error };
  revalidatePath(`/finanzas/centros-costo/${centroId}`);
  revalidatePath("/finanzas/centros-costo");
  return {};
}

export async function alternarActivoCentroCosto(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.centroCosto.updateMany({ where: { id, empresaId }, data: { activo } });
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
  const empresaId = await obtenerEmpresaActivaId();

  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  const montoPresupuestado = Number(formData.get("montoPresupuestado"));

  if (!esPeriodoMensualValido(anio, mes)) {
    return { error: "Período inválido." };
  }
  if (!Number.isFinite(montoPresupuestado) || montoPresupuestado < 0) {
    return { error: "El monto presupuestado debe ser un número válido." };
  }

  const centro = await prisma.centroCosto.findFirst({ where: { id: centroCostoId, empresaId }, select: { id: true } });
  if (!centro) return { error: "El centro de costo no existe en la compañía activa." };
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
  const empresaId = await obtenerEmpresaActivaId();

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
    where: { id: { in: lineas.map((l) => l.centroCostoId) }, empresaId, activo: true },
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
  const empresaId = await obtenerEmpresaActivaId();

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
      { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre, empresaId }
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
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.reglaAsignacionCosto.updateMany({
    where: { id, lineas: { some: { centroCosto: { empresaId } } } },
    data: { activo },
  });
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
  const empresaId = await obtenerEmpresaActivaId();
  if (!esClaveControlValida(clave)) return { error: "La clave contable es inválida." };

  const valor = String(formData.get("valor") ?? "");
  if (!valor) {
    await prisma.centroCostoControl.deleteMany({ where: { empresaId, clave } });
    revalidatePath("/finanzas/centros-costo/reglas");
    return {};
  }

  const destino = normalizarDestinoControlCosto(valor);
  if (!destino) return { error: "Seleccione una asignación de costo válida." };

  const destinoActivo =
    destino.tipo === "regla"
      ? await prisma.reglaAsignacionCosto.findFirst({
          where: { id: destino.id, activo: true, lineas: { some: { centroCosto: { empresaId } } } },
          select: { id: true },
        })
      : await prisma.centroCosto.findFirst({
          where: { id: destino.id, empresaId, activo: true },
          select: { id: true },
        });
  if (!destinoActivo) return { error: "La asignación seleccionada ya no está activa." };

  const data =
    destino.tipo === "regla"
      ? { centroCostoId: null, reglaId: destino.id }
      : { centroCostoId: destino.id, reglaId: null };

  await prisma.centroCostoControl.upsert({
    where: { empresaId_clave: { empresaId, clave } },
    update: data,
    create: { empresaId, clave, ...data },
  });

  revalidatePath("/finanzas/centros-costo/reglas");
  return {};
}
