import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { codigoTipoDocumento, esPeriodoPLEValido, generarArchivoPLE, generarLineaCompra, periodoAAAAMM, separarSerieNumero } from "@/lib/ple";

export async function GET(req: NextRequest) {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (
    (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA") ||
    !(await puedeRealizar(usuario, "finanzas", "ver"))
  ) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const anio = Number(req.nextUrl.searchParams.get("anio"));
  const mes = Number(req.nextUrl.searchParams.get("mes"));
  if (!esPeriodoPLEValido(anio, mes)) {
    return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  }

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const cuentas = await prisma.cuentaPorPagar.findMany({
    where: { fechaEmision: { gte: desde, lt: hasta } },
    include: { proveedor: true },
    orderBy: { fechaEmision: "asc" },
  });

  // El IGV no está desglosado en CuentaPorPagar (solo el total ya con
  // impuesto); se estima con la tasa vigente estándar (18%) para la base
  // imponible y el IGV — mismo criterio que el resto del ERP usa como tasa
  // por defecto (ver ConfiguracionEmpresa.tasaIgv).
  const configuracion = await prisma.configuracionEmpresa.findFirst();
  const tasaIgv = (configuracion?.tasaIgv.toNumber() ?? 18) / 100;

  let correlativo = 0;
  const lineas = cuentas.map((c) => {
    const { serie, numero } = separarSerieNumero(c.numeroDocumento);
    correlativo += 1;
    const total = c.total.toNumber();
    const base = total / (1 + tasaIgv);
    const igv = total - base;
    return generarLineaCompra(anio, mes, {
      correlativo,
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento,
      tipoComprobante: c.tipoComprobante,
      serie,
      numero,
      tipoDocProveedor: codigoTipoDocumento(c.proveedor.ruc),
      numeroDocProveedor: c.proveedor.ruc ?? "",
      razonSocialProveedor: c.proveedor.razonSocial,
      baseImponible: base,
      igv,
      total,
      moneda: c.monedaOriginal ?? c.moneda,
      tipoCambio: c.tipoCambio?.toNumber() ?? null,
    });
  });

  const contenido = generarArchivoPLE(lineas);
  const nombreArchivo = `LE_${periodoAAAAMM(anio, mes)}_8.1.txt`;

  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/plain; charset=iso-8859-1",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
