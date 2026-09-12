"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { diasVencidos } from "@/lib/cobranza";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { validarRespuesta, type EstadoRegistrado } from "@/lib/gestionCobranza";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

export async function registrarAvisoCobranza(facturaId: string) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const empresaId = await obtenerEmpresaActivaId();
  const factura = await prisma.factura.findFirst({ where: { id: facturaId, empresaId } });
  if (!factura) return { error: "La factura no existe." };
  if (factura.saldo.toNumber() <= 1e-9) return { error: "Esta factura ya no tiene saldo pendiente." };

  const dias = diasVencidos(factura.fechaVencimiento);
  const nivel = dias > 30 ? 3 : dias > 15 ? 2 : 1;

  await prisma.avisoCobranza.create({
    data: {
      clienteId: factura.clienteId,
      facturaId,
      empresaId,
      nivel,
      diasVencidos: dias,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath("/finanzas/cobranza");
  return {};
}

// Registra qué contestó el cliente al aviso. El id del aviso llega del
// navegador: se busca siempre acotado a la compañía activa.
export async function registrarRespuestaAviso(
  avisoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const estado = String(formData.get("estado") ?? "");
  const fechaRaw = String(formData.get("compromisoPagoEn") ?? "").trim();
  const detalle = String(formData.get("detalleRespuesta") ?? "").trim();

  // Una fecha mal escrita no puede terminar guardada como `null` silencioso:
  // el compromiso quedaría sin fecha y el incumplimiento nunca se derivaría.
  const compromisoPagoEn = fechaRaw ? crearFechaCalendarioLocal(fechaRaw) : null;
  if (fechaRaw && !compromisoPagoEn) return { error: "La fecha comprometida no es válida." };

  const error = validarRespuesta(estado, compromisoPagoEn, detalle);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  const actualizado = await prisma.avisoCobranza.updateMany({
    where: { id: avisoId, empresaId },
    data: {
      estado: estado as EstadoRegistrado,
      // La fecha solo tiene sentido con el compromiso: al cambiar a otro estado
      // se limpia, para que no quede un compromiso fantasma del que se derive
      // un incumplimiento que ya nadie sostiene.
      compromisoPagoEn: estado === "COMPROMISO_PAGO" ? compromisoPagoEn : null,
      // Por lo mismo, "sin respuesta aún" no puede quedarse con el texto de una
      // respuesta anterior: sería una contradicción en la misma fila.
      detalleRespuesta: estado === "PENDIENTE" ? null : detalle || null,
      respondidoEn: new Date(),
      respondidoPorId: auth.usuario.id,
      respondidoPorNombre: auth.usuario.nombre,
    },
  });
  if (actualizado.count !== 1) return { error: "El aviso no pertenece a la compañía activa." };

  revalidatePath("/finanzas/cobranza");
  return {};
}

export async function alternarBloqueoCliente(clienteId: string, bloquear: boolean) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite bloquear clientes por cobranza." };
  }

  const empresaId = await obtenerEmpresaActivaId();
  const resultado = await prisma.cliente.updateMany({
    where: { id: clienteId, empresaId },
    data: bloquear
      ? { bloqueadoCobranza: true, bloqueadoCobranzaEn: new Date(), bloqueadoCobranzaPor: auth.usuario.nombre }
      : { bloqueadoCobranza: false, bloqueadoCobranzaEn: null, bloqueadoCobranzaPor: null },
  });
  if (resultado.count !== 1) return { error: "El cliente no existe en la empresa activa." };

  revalidatePath("/finanzas/cobranza");
  revalidatePath("/comercial/clientes");
  return {};
}
