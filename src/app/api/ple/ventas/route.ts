import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { codigoTipoDocumento, generarArchivoPLE, generarLineaVenta, periodoAAAAMM, separarSerieNumero } from "@/lib/ple";

export async function GET(req: NextRequest) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const anio = Number(req.nextUrl.searchParams.get("anio"));
  const mes = Number(req.nextUrl.searchParams.get("mes"));
  if (!anio || !mes || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  }

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const [facturas, notasCredito] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta } },
      include: { cliente: true },
      orderBy: { fechaEmision: "asc" },
    }),
    prisma.notaCredito.findMany({
      where: { fecha: { gte: desde, lt: hasta } },
      include: { factura: { include: { cliente: true } } },
      orderBy: { fecha: "asc" },
    }),
  ]);

  let correlativo = 0;
  const lineas = [
    ...facturas.map((f) => {
      const { serie, numero } = separarSerieNumero(f.numero);
      correlativo += 1;
      return generarLineaVenta(anio, mes, {
        correlativo,
        fechaEmision: f.fechaEmision,
        fechaVencimiento: f.fechaVencimiento,
        tipoComprobante: "01",
        serie,
        numero,
        tipoDocCliente: codigoTipoDocumento(f.cliente.ruc),
        numeroDocCliente: f.cliente.ruc ?? "",
        razonSocialCliente: f.cliente.razonSocial,
        baseImponible: f.subtotal.toNumber(),
        igv: f.igv.toNumber(),
        total: f.total.toNumber(),
        moneda: f.moneda,
        tipoCambio: null,
      });
    }),
    ...notasCredito.map((nc) => {
      const { serie, numero } = separarSerieNumero(nc.numero);
      const original = separarSerieNumero(nc.factura.numero);
      correlativo += 1;
      // La base imponible/IGV de la NC se prorratean del monto total ajustado
      // usando la misma tasa de IGV de la factura original (no se guarda un
      // desglose propio de la NC en el modelo hoy).
      const tasaIgv = nc.factura.tasaIgv.toNumber() / 100;
      const montoNc = nc.monto.toNumber();
      const baseNc = tasaIgv > 0 ? montoNc / (1 + tasaIgv) : montoNc;
      const igvNc = montoNc - baseNc;
      return generarLineaVenta(anio, mes, {
        correlativo,
        fechaEmision: nc.fecha,
        fechaVencimiento: null,
        tipoComprobante: "07",
        serie,
        numero,
        tipoDocCliente: codigoTipoDocumento(nc.factura.cliente.ruc),
        numeroDocCliente: nc.factura.cliente.ruc ?? "",
        razonSocialCliente: nc.factura.cliente.razonSocial,
        baseImponible: baseNc,
        igv: igvNc,
        total: montoNc,
        moneda: nc.factura.moneda,
        tipoCambio: null,
        refFechaEmision: nc.factura.fechaEmision,
        refTipoComprobante: "01",
        refSerie: original.serie,
        refNumero: original.numero,
      });
    }),
  ];

  const contenido = generarArchivoPLE(lineas);
  const nombreArchivo = `LE_${periodoAAAAMM(anio, mes)}_14.1.txt`;

  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/plain; charset=iso-8859-1",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
