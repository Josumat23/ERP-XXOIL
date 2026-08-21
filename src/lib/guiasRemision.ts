import "server-only";

import { prisma } from "@/lib/prisma";
import { enviarComprobanteElectronico } from "@/lib/facturacionElectronica";

// Arma los datos SUNAT de una guía ya creada y los envía al OSE configurado.
// Solo debe llamarse desde flujos que ya validaron autorización.
export async function enviarComprobanteGuiaInterno(guiaId: string): Promise<void> {
  const guia = await prisma.guiaRemision.findUnique({
    where: { id: guiaId },
    include: {
      cliente: true,
      ubigeoPartida: true,
      ubigeoLlegada: true,
      detalles: { include: { presentacion: true } },
    },
  });
  if (!guia) return;

  const [serie, numeroStr] = guia.numero.split("-");
  const numero = parseInt(numeroStr ?? "", 10);

  await enviarComprobanteElectronico({
    tipoDocumento: "GUIA_REMISION",
    documentoId: guia.id,
    numeroDocumento: guia.numero,
    datos: {
      tipoDocumento: "GUIA_REMISION",
      serie: serie || guia.numero,
      numero: Number.isFinite(numero) ? numero : 0,
      clienteRuc: guia.cliente.ruc ?? "",
      clienteDenominacion: guia.cliente.razonSocial,
      clienteDireccion: guia.cliente.direccion,
      fechaEmision: guia.creadoEn,
      moneda: "PEN",
      totalGravada: 0,
      totalIgv: 0,
      total: 0,
      items: guia.detalles.map((d) => ({
        descripcion: d.presentacion.nombre,
        unidadMedida: d.presentacion.unidadMedidaSunat,
        cantidad: d.cantidad,
        valorUnitario: 0,
      })),
      guia: {
        destinatarioRuc: guia.cliente.ruc ?? "",
        destinatarioDenominacion: guia.cliente.razonSocial,
        fechaTraslado: guia.fechaTraslado,
        pesoBrutoTotal: guia.pesoBrutoTotal.toNumber(),
        modalidadTransporte: guia.modalidadTransporte,
        puntoPartidaDireccion: guia.puntoPartida,
        puntoPartidaUbigeo: guia.ubigeoPartida?.codigo ?? "",
        puntoLlegadaDireccion: guia.puntoLlegada,
        puntoLlegadaUbigeo: guia.ubigeoLlegada?.codigo ?? "",
        motivoTraslado: guia.motivoTraslado,
        transportistaRuc: guia.transportistaRuc,
        transportistaDenominacion: guia.transportista,
        placaVehiculo: guia.placaVehiculo,
        dniConductor: guia.dniConductor,
      },
    },
  });
}
