"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroOrdenCompra, siguienteNumeroRfq } from "@/lib/correlativos";
import { normalizarLineasOfertaRfq, normalizarLineasRfq } from "@/lib/rfq";

export type EstadoRfqFormulario = { error?: string };

function jsonFormulario(formData: FormData, campo: string): unknown {
  try { return JSON.parse(String(formData.get(campo) ?? "[]")); } catch { return null; }
}

export async function crearRfq(_estado: EstadoRfqFormulario, formData: FormData): Promise<EstadoRfqFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) return { error: "No tiene permiso para crear RFQ." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  const fechaLimiteTexto = String(formData.get("fechaLimite") ?? "");
  const lineas = normalizarLineasRfq(jsonFormulario(formData, "lineas"));
  if (titulo.length < 4) return { error: "Ingrese un título de al menos 4 caracteres." };
  if (!lineas?.length) return { error: "Agregue líneas válidas, sin insumos repetidos." };
  const empresaId = auth.usuario.empresaId;
  let id = "";
  try {
    await prisma.$transaction(async (tx) => {
      const insumos = await tx.insumo.count({ where: { empresaId, activo: true, id: { in: lineas.map((l) => l.insumoId) } } });
      if (insumos !== lineas.length) throw new Error("Uno de los insumos no pertenece a la empresa activa.");
      const numero = await siguienteNumeroRfq(tx, empresaId);
      const rfq = await tx.rfqCompra.create({ data: {
        empresaId, numero, titulo, fechaLimite: fechaLimiteTexto ? new Date(`${fechaLimiteTexto}T12:00:00`) : null,
        usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre,
        lineas: { create: lineas },
      } });
      id = rfq.id;
    });
  } catch (e) { return { error: e instanceof Error ? e.message : "No se pudo crear el RFQ." }; }
  revalidatePath("/logistica/rfq");
  redirect(`/logistica/rfq/${id}`);
}

export async function registrarOferta(rfqId: string, _estado: EstadoRfqFormulario, formData: FormData): Promise<EstadoRfqFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return { error: "No tiene permiso para registrar ofertas." };
  const proveedorId = String(formData.get("proveedorId") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = moneda === "PEN" ? 1 : Number(formData.get("tipoCambio"));
  const condicionPagoDias = Number(formData.get("condicionPagoDias"));
  const plazoEntregaDias = Number(formData.get("plazoEntregaDias"));
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const lineas = normalizarLineasOfertaRfq(jsonFormulario(formData, "lineas"));
  if (!proveedorId || !lineas?.length) return { error: "Complete el proveedor y todos los precios." };
  if (!(["PEN", "USD"].includes(moneda)) || !Number.isFinite(tipoCambio) || tipoCambio <= 0) return { error: "Moneda o tipo de cambio inválido." };
  if (!Number.isInteger(condicionPagoDias) || condicionPagoDias < 0 || !Number.isInteger(plazoEntregaDias) || plazoEntregaDias < 0) return { error: "Los plazos deben ser días enteros no negativos." };
  try {
    await prisma.$transaction(async (tx) => {
      const rfq = await tx.rfqCompra.findFirst({ where: { id: rfqId, empresaId: auth.usuario.empresaId, estado: "ABIERTO" }, include: { lineas: true } });
      if (!rfq) throw new Error("El RFQ no está abierto o no pertenece a la empresa activa.");
      const proveedor = await tx.proveedor.findFirst({ where: { id: proveedorId, empresaId: auth.usuario.empresaId, activo: true } });
      if (!proveedor) throw new Error("Seleccione un proveedor activo de la empresa.");
      const mapa = new Map(lineas.map((l) => [l.rfqLineaId, l.costoUnitario]));
      if (mapa.size !== rfq.lineas.length || rfq.lineas.some((l) => !mapa.has(l.id))) throw new Error("Cotice todas las líneas del RFQ una sola vez.");
      const detalle = rfq.lineas.map((l) => ({ rfqLineaId: l.id, costoUnitario: mapa.get(l.id)!, subtotal: l.cantidad.toNumber() * mapa.get(l.id)! }));
      await tx.ofertaRfq.create({ data: { rfqId, proveedorId, moneda, tipoCambio, condicionPagoDias, plazoEntregaDias, notas,
        total: detalle.reduce((s, l) => s + l.subtotal, 0), usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre, lineas: { create: detalle } } });
    });
  } catch (e) { return { error: e instanceof Error ? e.message : "No se pudo registrar la oferta." }; }
  revalidatePath(`/logistica/rfq/${rfqId}`);
  return {};
}

export async function adjudicarOferta(rfqId: string, ofertaId: string, _estado: EstadoRfqFormulario, formData: FormData): Promise<EstadoRfqFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return { error: "No tiene permiso para adjudicar ofertas." };
  const justificacion = String(formData.get("justificacion") ?? "").trim();
  if (justificacion.length < 12) return { error: "La justificación de adjudicación debe tener al menos 12 caracteres." };
  let ordenId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const rfq = await tx.rfqCompra.findFirst({ where: { id: rfqId, empresaId: auth.usuario.empresaId, estado: "ABIERTO" }, include: { ofertas: { include: { lineas: { include: { rfqLinea: true } } } } } });
      if (!rfq) throw new Error("El RFQ ya no está disponible para adjudicar.");
      if (rfq.ofertas.length < 2) throw new Error("Registre ofertas de al menos dos proveedores antes de adjudicar.");
      const ganadora = rfq.ofertas.find((o) => o.id === ofertaId);
      if (!ganadora) throw new Error("La oferta elegida no pertenece al RFQ.");
      await tx.ofertaRfq.updateMany({ where: { rfqId }, data: { estado: "NO_SELECCIONADA" } });
      await tx.ofertaRfq.update({ where: { id: ganadora.id }, data: { estado: "ADJUDICADA" } });
      const numero = await siguienteNumeroOrdenCompra(tx);
      const configuracion = await tx.configuracionEmpresa.findUniqueOrThrow({ where: { id: "1" } });
      const totalPen = ganadora.moneda === "USD" ? ganadora.total.toNumber() * ganadora.tipoCambio.toNumber() : ganadora.total.toNumber();
      const fechaEntrega = new Date(); fechaEntrega.setDate(fechaEntrega.getDate() + ganadora.plazoEntregaDias);
      const orden = await tx.ordenCompra.create({ data: { empresaId: auth.usuario.empresaId, numero, proveedorId: ganadora.proveedorId,
        moneda: ganadora.moneda, tipoCambio: ganadora.tipoCambio, total: ganadora.total, rfqId,
        notas: `Generada desde ${rfq.numero}. ${justificacion}`, estadoAprobacion: totalPen >= configuracion.montoAprobacionCompras.toNumber() ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre,
        detalles: { create: ganadora.lineas.map((l) => ({ insumoId: l.rfqLinea.insumoId, cantidad: l.rfqLinea.cantidad, costoUnitario: l.costoUnitario, subtotal: l.subtotal, fechaEntregaEsperada: fechaEntrega })) } } });
      await tx.rfqCompra.update({ where: { id: rfqId }, data: { estado: "ADJUDICADO", justificacionAdjudicacion: justificacion, adjudicadaEn: new Date(), adjudicadaPorId: auth.usuario.id, adjudicadaPorNombre: auth.usuario.nombre } });
      ordenId = orden.id;
    });
  } catch (e) { return { error: e instanceof Error ? e.message : "No se pudo adjudicar la oferta." }; }
  revalidatePath("/logistica/rfq"); revalidatePath("/logistica/ordenes-compra");
  redirect(`/logistica/ordenes-compra/${ordenId}`);
}
