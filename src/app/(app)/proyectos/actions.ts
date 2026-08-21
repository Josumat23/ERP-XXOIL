"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { reservarCorrelativo, siguienteCodigoProyecto } from "@/lib/correlativos";
import {
  recalcularRutaCritica,
  formariaCiclo,
  edtPerteneceAProyecto,
  siguienteCodigoActividad,
  siguienteCodigoEdt,
} from "@/lib/proyectos";
import { crearFechaCalendarioLocal } from "@/lib/fechas";

export type EstadoFormulario = { error?: string };

const ESTADOS_VALIDOS: $Enums.EstadoProyecto[] = ["PLANIFICADO", "EN_PROGRESO", "CERRADO", "CANCELADO"];

export async function crearProyecto(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Proyectos." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const responsableId = String(formData.get("responsableId") ?? "") || null;
  const presupuestoTotal = Number(formData.get("presupuestoTotal"));
  const fechaInicioPlanRaw = String(formData.get("fechaInicioPlan") ?? "");
  const fechaFinPlanRaw = String(formData.get("fechaFinPlan") ?? "");

  if (!nombre) return { error: "El nombre del proyecto es obligatorio." };
  if (!Number.isFinite(presupuestoTotal) || presupuestoTotal <= 0) {
    return { error: "El presupuesto total debe ser mayor a 0." };
  }
  const fechaInicioPlan = crearFechaCalendarioLocal(fechaInicioPlanRaw);
  const fechaFinPlan = crearFechaCalendarioLocal(fechaFinPlanRaw);
  if (!fechaInicioPlan) {
    return { error: "Ingrese una fecha de inicio planificada válida." };
  }
  if (!fechaFinPlan) {
    return { error: "Ingrese una fecha de fin planificada válida." };
  }
  if (fechaFinPlan < fechaInicioPlan) {
    return { error: "La fecha de fin planificada no puede ser anterior al inicio." };
  }

  let proyectoId = "";
  await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoProyecto(tx);
    const proyecto = await tx.proyecto.create({
      data: {
        codigo,
        nombre,
        descripcion,
        centroCostoId,
        responsableId,
        presupuestoTotal,
        fechaInicioPlan,
        fechaFinPlan,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });
    proyectoId = proyecto.id;
  });

  revalidatePath("/proyectos");
  redirect(`/proyectos/${proyectoId}`);
}

export async function cambiarEstadoProyecto(id: string, nuevoEstado: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) return;
  if (!ESTADOS_VALIDOS.includes(nuevoEstado as $Enums.EstadoProyecto)) return;

  const estado = nuevoEstado as $Enums.EstadoProyecto;
  const proyecto = await prisma.proyecto.findUnique({ where: { id } });
  if (!proyecto) return;

  await prisma.proyecto.update({
    where: { id },
    data: {
      estado,
      fechaInicioReal: estado === "EN_PROGRESO" && !proyecto.fechaInicioReal ? new Date() : undefined,
      fechaFinReal: estado === "CERRADO" && !proyecto.fechaFinReal ? new Date() : undefined,
    },
  });

  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
}

export async function crearEdt(
  proyectoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Proyectos." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const presupuestoRaw = String(formData.get("presupuesto") ?? "").trim();
  const presupuesto = presupuestoRaw ? Number(presupuestoRaw) : null;

  if (!nombre) return { error: "Ingrese el nombre de la fase." };
  if (presupuesto !== null && (!Number.isFinite(presupuesto) || presupuesto < 0)) {
    return { error: "El presupuesto debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const proyecto = await tx.proyecto.findUniqueOrThrow({ where: { id: proyectoId } });
      await reservarCorrelativo(tx);
      let codigoPadre: string | null = null;
      if (parentId) {
        const parent = await tx.edtProyecto.findUniqueOrThrow({ where: { id: parentId } });
        if (parent.proyectoId !== proyectoId) throw new Error("La fase padre no pertenece a este proyecto.");
        codigoPadre = parent.codigo;
      }
      const hermanos = await tx.edtProyecto.findMany({
        where: parentId ? { parentId } : { proyectoId, parentId: null },
        select: { codigo: true },
      });
      const codigo = siguienteCodigoEdt(hermanos.map((hermano) => hermano.codigo), codigoPadre);
      await tx.edtProyecto.create({
        data: { proyectoId: proyecto.id, parentId, codigo, nombre, presupuesto },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return {};
}

export async function crearActividad(
  edtId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Proyectos." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const duracionDias = Number(formData.get("duracionDias"));
  const responsableId = String(formData.get("responsableId") ?? "") || null;
  const equipoId = String(formData.get("equipoId") ?? "") || null;

  if (!nombre) return { error: "Ingrese el nombre de la actividad." };
  if (!Number.isInteger(duracionDias) || duracionDias <= 0) {
    return { error: "La duración (días) debe ser un entero mayor a 0." };
  }

  let proyectoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const edt = await tx.edtProyecto.findUniqueOrThrow({ where: { id: edtId } });
      proyectoId = edt.proyectoId;
      await reservarCorrelativo(tx);
      const actividades = await tx.actividadProyecto.findMany({
        where: { edtId },
        select: { codigo: true },
      });
      const codigo = siguienteCodigoActividad(actividades.map((actividad) => actividad.codigo));
      await tx.actividadProyecto.create({
        data: { edtId, codigo, nombre, duracionDias, responsableId, equipoId },
      });
      await recalcularRutaCritica(tx, proyectoId);
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return {};
}

export async function eliminarActividad(id: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) return;

  let proyectoId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const actividad = await tx.actividadProyecto.findUnique({
      where: { id },
      select: { edt: { select: { proyectoId: true } } },
    });
    if (!actividad) throw new Error("La actividad no existe.");
    proyectoId = actividad.edt.proyectoId;

    const dependientes = await tx.precedenciaActividad.count({ where: { actividadPredecesoraId: id } });
    if (dependientes > 0) {
      throw new Error("No se puede eliminar: otras actividades dependen de esta como predecesora.");
    }
    await tx.precedenciaActividad.deleteMany({ where: { actividadSucesoraId: id } });
    await tx.actividadProyecto.delete({ where: { id } });
    await recalcularRutaCritica(tx, proyectoId);
  });

  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function crearPrecedencia(
  proyectoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Proyectos." };
  }

  const actividadPredecesoraId = String(formData.get("actividadPredecesoraId") ?? "");
  const actividadSucesoraId = String(formData.get("actividadSucesoraId") ?? "");

  if (!actividadPredecesoraId || !actividadSucesoraId) {
    return { error: "Seleccione ambas actividades." };
  }
  if (actividadPredecesoraId === actividadSucesoraId) {
    return { error: "Una actividad no puede preceder a sí misma." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const [predecesora, sucesora] = await Promise.all([
        tx.actividadProyecto.findUniqueOrThrow({
          where: { id: actividadPredecesoraId },
          include: { edt: true },
        }),
        tx.actividadProyecto.findUniqueOrThrow({
          where: { id: actividadSucesoraId },
          include: { edt: true },
        }),
      ]);
      if (predecesora.edt.proyectoId !== proyectoId || sucesora.edt.proyectoId !== proyectoId) {
        throw new Error("Ambas actividades deben pertenecer a este proyecto.");
      }
      if (await formariaCiclo(tx, actividadPredecesoraId, actividadSucesoraId)) {
        throw new Error("Esa precedencia formaría un ciclo en la red de actividades.");
      }
      await tx.precedenciaActividad.create({ data: { actividadPredecesoraId, actividadSucesoraId } });
      await recalcularRutaCritica(tx, proyectoId);
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes("Unique constraint")) {
        return { error: "Esa precedencia ya existe." };
      }
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return {};
}

export async function eliminarPrecedencia(id: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) return;

  let proyectoId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const precedencia = await tx.precedenciaActividad.findUnique({
      where: { id },
      select: {
        predecesora: { select: { edt: { select: { proyectoId: true } } } },
        sucesora: { select: { edt: { select: { proyectoId: true } } } },
      },
    });
    if (!precedencia) throw new Error("La precedencia no existe.");
    const proyectoPredecesora = precedencia.predecesora.edt.proyectoId;
    if (precedencia.sucesora.edt.proyectoId !== proyectoPredecesora) {
      throw new Error("La precedencia enlaza actividades de proyectos distintos.");
    }
    proyectoId = proyectoPredecesora;

    await tx.precedenciaActividad.delete({ where: { id } });
    await recalcularRutaCritica(tx, proyectoId);
  });

  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function agregarCostoProyecto(
  proyectoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "proyectos", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Proyectos." };
  }

  const edtId = String(formData.get("edtId") ?? "") || null;
  const concepto = String(formData.get("concepto") ?? "").trim();
  const monto = Number(formData.get("monto"));

  if (!concepto) return { error: "Ingrese el concepto del costo." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };

  try {
    await prisma.$transaction(async (tx) => {
      const proyecto = await tx.proyecto.findUnique({ where: { id: proyectoId }, select: { id: true } });
      if (!proyecto) throw new Error("El proyecto no existe.");

      if (edtId) {
        const edt = await tx.edtProyecto.findUnique({ where: { id: edtId }, select: { proyectoId: true } });
        if (!edtPerteneceAProyecto(edt, proyectoId)) {
          throw new Error("La fase seleccionada no pertenece a este proyecto.");
        }
      }

      await tx.costoProyecto.create({
        data: {
          proyectoId,
          edtId,
          concepto,
          monto,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return {};
}
