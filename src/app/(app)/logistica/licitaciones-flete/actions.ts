"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroLicitacionFlete } from "@/lib/correlativos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import {
  revisarAdjudicacion,
  validarJustificacion,
  validarLicitacion,
  validarOferta,
} from "@/lib/licitacionFlete";

export type EstadoFormulario = { error?: string };

async function autorizar() {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." } as const;
  }
  return auth;
}

export async function crearLicitacionFlete(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = {
    titulo: String(formData.get("titulo") ?? "").trim(),
    origen: String(formData.get("origen") ?? "").trim(),
    destino: String(formData.get("destino") ?? "").trim(),
    pesoEstimadoKg: Number(formData.get("pesoEstimadoKg")),
  };
  const error = validarLicitacion(datos);
  if (error) return { error };

  const fechaRequeridaRaw = String(formData.get("fechaRequerida") ?? "").trim();
  const fechaRequerida = fechaRequeridaRaw ? crearFechaCalendarioLocal(fechaRequeridaRaw) : null;
  if (!fechaRequerida) return { error: "Indique la fecha en que se necesita el traslado." };
  const fechaLimiteRaw = String(formData.get("fechaLimite") ?? "").trim();
  const fechaLimite = fechaLimiteRaw ? crearFechaCalendarioLocal(fechaLimiteRaw) : null;

  const empresaId = await obtenerEmpresaActivaId();
  // Los ubigeos llegan del navegador: se validan contra el catálogo dentro de
  // la misma transacción, y si no existen se guarda la licitación sin ellos en
  // vez de persistir un código inventado.
  const ubigeoOrigenId = String(formData.get("ubigeoOrigenId") ?? "").trim() || null;
  const ubigeoDestinoId = String(formData.get("ubigeoDestinoId") ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    const validos = await tx.ubigeo.findMany({
      where: { id: { in: [ubigeoOrigenId, ubigeoDestinoId].filter((x): x is string => x !== null) } },
      select: { id: true },
    });
    const existe = new Set(validos.map((u) => u.id));
    const numero = await siguienteNumeroLicitacionFlete(tx, empresaId);
    await tx.licitacionFlete.create({
      data: {
        empresaId,
        numero,
        ...datos,
        fechaRequerida,
        fechaLimite,
        ubigeoOrigenId: ubigeoOrigenId && existe.has(ubigeoOrigenId) ? ubigeoOrigenId : null,
        ubigeoDestinoId: ubigeoDestinoId && existe.has(ubigeoDestinoId) ? ubigeoDestinoId : null,
        notas: String(formData.get("notas") ?? "").trim() || null,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });
  });

  revalidatePath("/logistica/licitaciones-flete");
  return {};
}

export async function registrarOfertaFlete(
  licitacionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const transportistaId = String(formData.get("transportistaId") ?? "").trim();
  if (!transportistaId) return { error: "Seleccione el transportista que cotiza." };

  const moneda = String(formData.get("moneda") ?? "PEN");
  const datos = {
    monto: Number(formData.get("monto")),
    diasTransito: Number(formData.get("diasTransito")),
    moneda,
    tipoCambio: moneda === "PEN" ? 1 : Number(formData.get("tipoCambio")),
  };
  const error = validarOferta(datos);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // Los dos ids llegan del navegador: la licitación tiene que ser de la
      // compañía activa y estar abierta, y el transportista de esa compañía.
      const licitacion = await tx.licitacionFlete.findFirst({
        where: { id: licitacionId, empresaId },
        select: { estado: true },
      });
      if (!licitacion) throw new Error("La licitación no pertenece a la compañía activa.");
      if (licitacion.estado !== "ABIERTA") {
        throw new Error("La licitación ya no está abierta: no admite ofertas nuevas.");
      }
      const transportista = await tx.transportista.findFirst({
        where: { id: transportistaId, empresaId, activo: true },
        select: { id: true },
      });
      if (!transportista) {
        throw new Error("El transportista no pertenece a la compañía activa o está desactivado.");
      }

      const validaHastaRaw = String(formData.get("validaHasta") ?? "").trim();
      await tx.ofertaFlete.create({
        data: {
          licitacionId,
          transportistaId,
          monto: datos.monto,
          moneda: datos.moneda,
          tipoCambio: datos.tipoCambio,
          diasTransito: datos.diasTransito,
          validaHasta: validaHastaRaw ? crearFechaCalendarioLocal(validaHastaRaw) : null,
          notas: String(formData.get("notas") ?? "").trim() || null,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        error: "Ese transportista ya cotizó esta licitación. Dos cotizaciones del mismo no son dos ofertas.",
      };
    }
    return { error: e instanceof Error ? e.message : "No se pudo registrar la oferta." };
  }

  revalidatePath("/logistica/licitaciones-flete");
  return {};
}

export async function adjudicarFlete(
  licitacionId: string,
  ofertaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const justificacion = String(formData.get("justificacion") ?? "").trim();
  const errorJustificacion = validarJustificacion(justificacion);
  if (errorJustificacion) return { error: errorJustificacion };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const licitacion = await tx.licitacionFlete.findFirst({
        where: { id: licitacionId, empresaId },
        include: { ofertas: true },
      });
      if (!licitacion) throw new Error("La licitación no pertenece a la compañía activa.");

      // Las tres reglas viven en una función pura que la suite prueba caso por
      // caso; aquí solo se ejecuta el veredicto.
      const revision = revisarAdjudicacion({
        estado: licitacion.estado,
        ofertas: licitacion.ofertas.map((o) => ({
          id: o.id,
          transportistaId: o.transportistaId,
          monto: o.monto.toNumber(),
          moneda: o.moneda,
          tipoCambio: o.tipoCambio.toNumber(),
          diasTransito: o.diasTransito,
        })),
        ofertaElegidaId: ofertaId,
        solicitanteId: licitacion.usuarioId,
        adjudicadorId: auth.usuario.id,
      });
      if (!revision.puede) throw new Error(revision.motivo);

      // Cierre optimista: si otro adjudicó entre la lectura y esta escritura,
      // count deja de ser 1 y no se pisa su decisión.
      const cerrada = await tx.licitacionFlete.updateMany({
        where: { id: licitacionId, empresaId, estado: "ABIERTA" },
        data: {
          estado: "ADJUDICADA",
          justificacionAdjudicacion: justificacion,
          adjudicadaEn: new Date(),
          adjudicadaPorId: auth.usuario.id,
          adjudicadaPorNombre: auth.usuario.nombre,
        },
      });
      if (cerrada.count !== 1) throw new Error("La licitación ya fue resuelta por otro usuario.");

      await tx.ofertaFlete.updateMany({
        where: { licitacionId },
        data: { estado: "NO_SELECCIONADA" },
      });
      await tx.ofertaFlete.update({ where: { id: ofertaId }, data: { estado: "ADJUDICADA" } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo adjudicar la licitación." };
  }

  revalidatePath("/logistica/licitaciones-flete");
  revalidatePath("/logistica/guias-remision/nueva");
  return {};
}

// Declararla desierta en vez de dejarla abierta para siempre: por qué no se
// contrató es información, y una bandeja llena de licitaciones muertas deja de
// mirarse.
export async function declararDesierta(
  licitacionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Indique por qué la licitación queda desierta." };
  if (motivo.length > 500) return { error: "El motivo no puede superar 500 caracteres." };

  const empresaId = await obtenerEmpresaActivaId();
  const cerrada = await prisma.licitacionFlete.updateMany({
    where: { id: licitacionId, empresaId, estado: "ABIERTA" },
    data: { estado: "DESIERTA", motivoDesierta: motivo },
  });
  if (cerrada.count !== 1) return { error: "La licitación ya no está abierta." };

  revalidatePath("/logistica/licitaciones-flete");
  return {};
}
