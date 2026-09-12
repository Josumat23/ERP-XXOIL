"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroHojaRuta } from "@/lib/correlativos";
import { normalizarVisitasRuta, type VisitaRutaNormalizada } from "@/lib/visitasRuta";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

export async function crearHojaRuta(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const vendedorId = String(formData.get("vendedorId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let visitasRaw: unknown;
  try {
    visitasRaw = JSON.parse(String(formData.get("visitas") ?? "[]"));
  } catch {
    return { error: "El detalle de visitas es inválido." };
  }
  const visitas: VisitaRutaNormalizada[] | null = normalizarVisitasRuta(visitasRaw);
  if (visitas === null) {
    return { error: "El detalle de visitas es inválido." };
  }

  if (!vendedorId) return { error: "Seleccione el vendedor." };
  if (!fecha) return { error: "Indique la fecha de la ruta." };
  const fechaRuta = crearFechaCalendarioLocal(fecha);
  if (!fechaRuta) return { error: "La fecha de la ruta es inválida." };
  if (visitas.length === 0) return { error: "Agregue al menos un cliente a visitar." };
  const empresaId = await obtenerEmpresaActivaId();

  let hojaId = "";
  await prisma.$transaction(async (tx) => {
    if (await tx.vendedor.count({ where: { id: vendedorId, empresaId, activo: true } }) !== 1) throw new Error("El vendedor no pertenece a la empresa activa.");
    if (await tx.cliente.count({ where: { id: { in: visitas.map((visita) => visita.clienteId) }, empresaId, activo: true } }) !== visitas.length) throw new Error("Un cliente no pertenece a la empresa activa.");
    const numero = await siguienteNumeroHojaRuta(tx, empresaId);
    const hoja = await tx.hojaRuta.create({
      data: {
        numero,
        empresaId,
        vendedorId,
        fecha: fechaRuta,
        notas,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        visitas: {
          create: visitas.map((v, idx) => ({
            clienteId: v.clienteId,
            orden: idx + 1,
            objetivo: v.objetivo.trim() || null,
          })),
        },
      },
    });
    hojaId = hoja.id;
  });

  revalidatePath("/comercial/hojas-ruta");
  redirect(`/comercial/hojas-ruta/${hojaId}`);
}

// Cierra la ruta registrando el resultado de cada visita (auditable).
export async function cerrarHojaRuta(
  hojaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }
  const empresaId = await obtenerEmpresaActivaId();

  const hoja = await prisma.hojaRuta.findFirst({
    where: { id: hojaId, empresaId },
    include: { visitas: true },
  });
  if (!hoja) return { error: "La hoja de ruta no existe." };
  if (hoja.estado === "COMPLETADA") return { error: "La ruta ya fue cerrada." };

  const cerrada = await prisma.$transaction(async (tx) => {
    const reclamo = await tx.hojaRuta.updateMany({
      where: { id: hojaId, empresaId, estado: "PLANIFICADA" },
      data: { estado: "COMPLETADA" },
    });
    if (reclamo.count !== 1) return false;

    for (const visita of hoja.visitas) {
      const resultado = String(formData.get(`resultado_${visita.id}`) ?? "").trim() || null;
      await tx.hojaRutaVisita.update({ where: { id: visita.id }, data: { resultado } });
    }
    return true;
  });
  if (!cerrada) {
    return { error: "La ruta cambi\u00f3 mientras se cerraba. Actualice la p\u00e1gina e intente nuevamente." };
  }

  revalidatePath("/comercial/hojas-ruta");
  revalidatePath(`/comercial/hojas-ruta/${hojaId}`);
  return {};
}
