"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroReclamo } from "@/lib/correlativos";
import type { $Enums } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

export async function crearReclamo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const clienteId = String(formData.get("clienteId") ?? "");
  const facturaId = String(formData.get("facturaId") ?? "") || null;
  const causaId = String(formData.get("causaId") ?? "") || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!descripcion) return { error: "Describa el reclamo." };

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: { id: clienteId, empresaId: auth.usuario.empresaId, activo: true },
        select: { id: true },
      });
      if (!cliente) throw new Error("El cliente no pertenece a la empresa activa.");
      if (causaId) {
        const causa = await tx.causaCalidad.findFirst({
          where: { id: causaId, empresaId: auth.usuario.empresaId, activo: true },
          select: { id: true },
        });
        if (!causa) throw new Error("La causa no pertenece a la empresa activa.");
      }
      if (facturaId) {
        const factura = await tx.factura.findFirst({
          where: { id: facturaId, empresaId: auth.usuario.empresaId },
          select: { clienteId: true },
        });
        if (!factura) throw new Error("La factura relacionada no existe.");
        if (factura.clienteId !== clienteId) {
          throw new Error("La factura relacionada pertenece a otro cliente.");
        }
      }
      const numero = await siguienteNumeroReclamo(tx);
      const creado = await tx.reclamoCliente.create({
        data: {
          empresaId: auth.usuario.empresaId,
          numero,
          clienteId,
          facturaId,
          causaId,
          descripcion,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      return creado.id;
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/calidad/reclamos");
  redirect(`/produccion/calidad/reclamos/${id}`);
}

const ESTADOS_VALIDOS: $Enums.EstadoReclamo[] = ["EN_PROCESO", "CERRADO"];

export async function actualizarEstadoReclamo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const estado = String(formData.get("estado") ?? "") as $Enums.EstadoReclamo;
  const accionCorrectiva = String(formData.get("accionCorrectiva") ?? "").trim() || null;

  if (!ESTADOS_VALIDOS.includes(estado)) return { error: "Estado inválido." };
  if (estado === "CERRADO" && !accionCorrectiva) {
    return { error: "Para cerrar el reclamo, indique la acción correctiva aplicada." };
  }

  const reclamo = await prisma.reclamoCliente.findFirst({
    where: { id, empresaId: auth.usuario.empresaId },
    select: { estado: true },
  });
  if (!reclamo) return { error: "El reclamo no existe." };
  if (reclamo.estado === "CERRADO") return { error: "El reclamo ya está cerrado." };
  if (reclamo.estado === "EN_PROCESO" && estado !== "CERRADO") {
    return { error: "Un reclamo en proceso solo puede cerrarse." };
  }

  const resultado = await prisma.reclamoCliente.updateMany({
    where: { id, empresaId: auth.usuario.empresaId, estado: reclamo.estado },
    data: {
      estado,
      accionCorrectiva,
      fechaCierre: estado === "CERRADO" ? new Date() : null,
    },
  });
  if (resultado.count !== 1) {
    return { error: "El reclamo cambió mientras se actualizaba. Actualice la página e intente nuevamente." };
  }

  revalidatePath("/produccion/calidad/reclamos");
  revalidatePath(`/produccion/calidad/reclamos/${id}`);
  return {};
}
