import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type $Enums } from "../src/generated/prisma/client";
import { registrarMovimiento } from "../src/lib/inventario";
import { asignarLoteVenta, asignarLoteInsumo } from "../src/lib/trazabilidad";
import {
  postearVenta,
  postearCobro,
  postearNotaCredito,
  postearRecepcionCompra,
  postearPagoProveedor,
  postearDepreciacion,
  postearMantenimiento,
} from "../src/lib/contabilidad";
import {
  siguienteCodigoCliente,
  siguienteNumeroPedido,
  siguienteNumeroOrdenCompra,
  siguienteNumeroRecepcion,
  siguienteCodigoLote,
  siguienteCodigoEnvasado,
  siguienteCodigoActivoFijo,
  siguienteCodigoEquipo,
  siguienteCodigoOrdenMantenimiento,
} from "../src/lib/correlativos";
import { avanzarSerie, formatearNumeroSerie } from "../src/lib/series";
import {
  trimestreDe,
  trimestreAnterior,
  ventasHistoricasPorTrimestre,
  calcularIndiceEstacionalidad,
} from "../src/lib/proyecciones";
import { obtenerFactorMacro } from "../src/lib/bcrp";

// ---------------------------------------------------------------------------
// Datos de prueba: reproduce el flujo real de negocio (compras → producción →
// ventas → cobros → contabilidad) llamando a las mismas funciones que usan
// las Server Actions de la app, para que el kardex, los costos, las
// comisiones y los asientos contables queden tan consistentes como si se
// hubiera cargado todo a mano desde la interfaz.
//
// Se corre UNA sola vez, después de `npx prisma db seed` (que carga el
// catálogo base). Si ya hay pedidos registrados, no hace nada — para
// recargar de cero, reseteá la base con `npx prisma migrate reset`.
// ---------------------------------------------------------------------------

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const hoy = new Date();
function fechaHace(mesesAtras: number, dia: number): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, dia, 10, 0, 0);
}
const DIAS_CONDICION = { CONTADO: 0, DIAS_15: 15, DIAS_30: 30 } as const;

// Crea las proyecciones de los últimos 2 trimestres si todavía no existen.
// Separada del resto del seed (que solo corre una vez, la primera vez) para
// que se pueda volver a ejecutar `npm run seed:demo` más adelante y esto se
// mantenga al día sin duplicar ni tocar los datos ya cargados.
async function seedProyeccionesHistoricas(audit: { usuarioId: string; usuarioNombre: string }) {
  const trimestreActual = trimestreDe(hoy);
  const trimestre1Atras = trimestreAnterior(trimestreActual.anio, trimestreActual.trimestre);
  const trimestre2Atras = trimestreAnterior(trimestre1Atras.anio, trimestre1Atras.trimestre);

  const presentacionesActivas = await prisma.presentacion.findMany({ where: { activo: true } });
  const historicoVentas = await ventasHistoricasPorTrimestre();
  const macro = await obtenerFactorMacro();

  let creadas = 0;
  for (const objetivo of [trimestre2Atras, trimestre1Atras]) {
    const base = trimestreAnterior(objetivo.anio, objetivo.trimestre);
    const yaExiste = await prisma.proyeccion.findUnique({
      where: {
        empresaId_anio_trimestre: { empresaId: "1", anio: objetivo.anio, trimestre: objetivo.trimestre },
      },
    });
    if (yaExiste) continue;

    await prisma.proyeccion.create({
      data: {
        anio: objetivo.anio,
        trimestre: objetivo.trimestre,
        anioBase: base.anio,
        trimestreBase: base.trimestre,
        macroPbiManufacturaVar: macro.pbiManufacturaVar,
        macroInflacionVar: macro.inflacionVar,
        macroTipoCambio: macro.tipoCambio,
        macroActualizadoEn: new Date(),
        ...audit,
        detalles: {
          create: presentacionesActivas.map((p) => {
            const historicoPresentacion = historicoVentas.get(p.id);
            const ventasBase = historicoPresentacion?.get(`${base.anio}-${base.trimestre}`) ?? 0;
            const indice = calcularIndiceEstacionalidad(
              historicoPresentacion,
              objetivo.trimestre,
              base.trimestre
            );
            return {
              presentacionId: p.id,
              ventasBase,
              indiceEstacionalidad: indice ?? 1,
            };
          }),
        },
      },
    });
    creadas++;
  }
  if (creadas > 0) {
    console.log(
      `Proyecciones creadas para ${trimestre2Atras.anio}-T${trimestre2Atras.trimestre} y/o ${trimestre1Atras.anio}-T${trimestre1Atras.trimestre} (estacionalidad calculada de la historia real de ventas).`
    );
  } else {
    console.log("Las proyecciones de los últimos 2 trimestres ya existían.");
  }
}

async function main() {
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { empresaId_usuario: { empresaId: "1", usuario: "admin" } },
  });
  const audit = { usuarioId: admin.id, usuarioNombre: admin.nombre };

  // Corre siempre (es idempotente por trimestre), incluso si el resto del
  // seed de abajo ya se saltó por tener pedidos cargados.
  await seedProyeccionesHistoricas(audit);

  if ((await prisma.pedido.count()) > 0) {
    console.log(
      "Ya hay pedidos registrados: se omite la carga de datos de prueba (para no duplicar)."
    );
    return;
  }

  // --- referencias a lo ya sembrado por prisma/seed.ts -----------------------
  const grasaChasis = await prisma.producto.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "GR-CHASIS" } },
  });
  const formula = await prisma.formula.findUniqueOrThrow({
    where: { productoId_version: { productoId: grasaChasis.id, version: 1 } },
    include: { detalles: true },
  });
  const presPote = await prisma.presentacion.findUniqueOrThrow({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-CHASIS-POTE-1LB" } },
  });
  const presBalde = await prisma.presentacion.findUniqueOrThrow({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-CHASIS-BALDE-35LB" } },
  });

  const provQuimicos = await prisma.proveedor.findUniqueOrThrow({
    where: { empresaId_ruc: { empresaId: "1", ruc: "20456789012" } },
  });
  const provEnvases = await prisma.proveedor.findUniqueOrThrow({
    where: { empresaId_ruc: { empresaId: "1", ruc: "20123456789" } },
  });

  const aceite = await prisma.insumo.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "MP-ACEITE-BASE" } },
  });
  const envPote = await prisma.insumo.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "ENV-POTE-1LB" } },
  });
  const envBalde = await prisma.insumo.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "ENV-BALDE-35LB" } },
  });
  const etqChasis = await prisma.insumo.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "ETQ-CHASIS" } },
  });

  const limaNorte = await prisma.zona.findUniqueOrThrow({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Lima Norte" } },
  });
  const limaSur = await prisma.zona.findUniqueOrThrow({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Lima Sur" } },
  });
  const provinciasZona = await prisma.zona.findUniqueOrThrow({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Provincias" } },
  });

  const carlos = await prisma.vendedor.findFirstOrThrow({ where: { nombre: "Carlos Huamán" } });
  const maria = await prisma.vendedor.findFirstOrThrow({ where: { nombre: "María Quispe" } });

  const serieFactura = await prisma.serieDocumento.findFirstOrThrow({
    where: { tipoDocumento: "FACTURA", serie: "F001" },
  });
  let correlativoFactura = serieFactura.correlativoActual;

  // ---------------------------------------------------------- 1. Almacenes
  // Segunda sede: demuestra que varios almacenes (incluso en otra ciudad)
  // ya son soportados sin cambios — solo se crea un registro más.
  await prisma.almacen.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "TRUJILLO" } },
    update: {},
    create: {
      codigo: "TRUJILLO",
      nombre: "Almacén Trujillo",
      ciudad: "Trujillo",
      provincia: "Trujillo",
      departamento: "La Libertad",
      encargado: "Jorge Salinas",
    },
  });
  console.log("Almacén de provincia creado (Trujillo).");

  // ---------------------------------------------------------- 2. Clientes
  const clientesNuevos = [
    {
      razonSocial: "Ferretería San Martín S.R.L.",
      ruc: "20789012345",
      zonaId: limaSur.id,
      vendedorId: carlos.id,
      direccion: "Av. Pachacútec 890, San Juan de Miraflores",
      telefono: "955112233",
    },
    {
      razonSocial: "Grifo y Lubricantes Costa Verde S.A.C.",
      ruc: "20890123456",
      zonaId: limaNorte.id,
      vendedorId: carlos.id,
      direccion: "Av. Universitaria 2200, Los Olivos",
      telefono: "966223344",
    },
    {
      razonSocial: "Comercial Andina del Sur E.I.R.L.",
      ruc: "20901234567",
      zonaId: provinciasZona.id,
      vendedorId: maria.id,
      direccion: "Calle Mercaderes 220, Arequipa",
      telefono: "977334455",
    },
  ];
  const clientes: { id: string; razonSocial: string; vendedorId: string }[] = [];
  for (const c of clientesNuevos) {
    const cliente = await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoCliente(tx);
      return tx.cliente.create({ data: { codigo, ...c } });
    });
    clientes.push(cliente);
    console.log(`Cliente creado: ${cliente.codigo} — ${cliente.razonSocial}`);
  }
  // + los 2 clientes ya sembrados por seed.ts (Lubricentro El Rápido, Distribuidora Ferretera)
  const clientesExistentes = await prisma.cliente.findMany({
    where: { codigo: { in: ["CLI-00001", "CLI-00002"] } },
    orderBy: { codigo: "asc" },
  });
  const carteraClientes = [
    { ...clientesExistentes[0], vendedorId: carlos.id },
    { ...clientesExistentes[1], vendedorId: maria.id },
    ...clientes,
  ];

  // ---------------------------------------------------- 3. Compras (2 OC)
  async function comprarInsumo(
    proveedorId: string,
    insumoId: string,
    cantidad: number,
    costoUnitario: number,
    docProveedor: string,
    mesesAtras: number
  ) {
    await prisma.$transaction(async (tx) => {
      const numeroOC = await siguienteNumeroOrdenCompra(tx);
      const oc = await tx.ordenCompra.create({
        data: {
          numero: numeroOC,
          proveedorId,
          total: cantidad * costoUnitario,
          estado: "RECIBIDA",
          ...audit,
          detalles: {
            create: [{ insumoId, cantidad, costoUnitario, cantidadRecibida: cantidad, subtotal: cantidad * costoUnitario }],
          },
        },
      });

      const numeroRecepcion = await siguienteNumeroRecepcion(tx);
      await tx.recepcionCompra.create({
        data: {
          numero: numeroRecepcion,
          ordenCompraId: oc.id,
          ...audit,
          detalles: { create: [{ insumoId, cantidad, costoUnitario, cantidadDisponible: cantidad }] },
        },
      });

      const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId } });
      const stockActual = insumo.stock.toNumber();
      const costoActual = insumo.costoUnitario.toNumber();
      const nuevoCosto =
        (stockActual * costoActual + cantidad * costoUnitario) / (stockActual + cantidad);
      await tx.insumo.update({ where: { id: insumoId }, data: { costoUnitario: nuevoCosto } });

      const mov = await registrarMovimiento(tx, {
        tipoItem: "INSUMO",
        insumoId,
        tipoMovimiento: "ENTRADA",
        origen: "COMPRA",
        cantidad,
        referencia: `Recepción ${numeroRecepcion} (${numeroOC}, doc. ${docProveedor})`,
        ...audit,
      });
      if (!mov.ok) throw new Error(mov.error);

      const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });
      const cxp = await tx.cuentaPorPagar.create({
        data: {
          proveedorId,
          ordenCompraId: oc.id,
          numeroDocumento: docProveedor,
          fechaVencimiento: fechaHace(mesesAtras, 28),
          total: cantidad * costoUnitario,
          saldo: cantidad * costoUnitario,
          ...audit,
        },
      });

      await postearRecepcionCompra(
        tx,
        {
          numeroRecepcion,
          documentoProveedor: docProveedor,
          proveedor: proveedor.razonSocial,
          total: cantidad * costoUnitario,
          fecha: fechaHace(mesesAtras, 5),
        },
        audit
      );

      // Una de las dos compras queda parcialmente pagada, para ver Cuentas por pagar con saldo.
      // (saldo > 0 sigue siendo "PENDIENTE" — no existe un estado "PARCIAL" en el modelo.)
      if (mesesAtras >= 4) {
        const pago = cantidad * costoUnitario * 0.6;
        const nuevoSaldo = cantidad * costoUnitario - pago;
        await tx.pagoProveedor.create({
          data: { cuentaPorPagarId: cxp.id, monto: pago, medioPago: "TRANSFERENCIA", ...audit },
        });
        await tx.movimientoCaja.create({
          data: {
            tipo: "EGRESO",
            concepto: `Pago a ${proveedor.razonSocial} (doc. ${docProveedor})`,
            monto: pago,
            medioPago: "TRANSFERENCIA",
            referencia: docProveedor,
            fecha: fechaHace(mesesAtras, 20),
            ...audit,
          },
        });
        await tx.cuentaPorPagar.update({
          where: { id: cxp.id },
          data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE" },
        });
        await postearPagoProveedor(
          tx,
          { documentoProveedor: docProveedor, proveedor: proveedor.razonSocial, monto: pago },
          audit
        );
      }
    });
  }

  await comprarInsumo(provQuimicos.id, aceite.id, 300, 7.0, "F002-1001", 5);
  await comprarInsumo(provEnvases.id, envPote.id, 500, 0.88, "F015-2050", 4);
  console.log("Órdenes de compra + recepciones registradas.");

  // --------------------------------------------- 4. Producción (3 lotes)
  async function producirLote(kgObjetivo: number, kgProducidos: number, horas: number) {
    return prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoLote(tx);
      const factor = kgObjetivo / formula.rendimientoKg.toNumber();
      const lote = await tx.loteGranel.create({
        data: { codigo, formulaId: formula.id, kgObjetivo, ...audit },
      });

      let costoInsumos = 0;
      for (const detalle of formula.detalles) {
        const cantidad = detalle.cantidad.toNumber() * factor;
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: detalle.insumoId } });
        costoInsumos += cantidad * insumo.costoUnitario.toNumber();
        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: detalle.insumoId,
          tipoMovimiento: "SALIDA",
          origen: "PRODUCCION",
          cantidad,
          referencia: `Lote ${codigo} (${grasaChasis.nombre} v${formula.version})`,
          ...audit,
        });
        if (!mov.ok) throw new Error(mov.error);

        await asignarLoteInsumo(tx, { loteGranelId: lote.id, insumoId: detalle.insumoId, cantidad });
      }

      const costoManoObra = 0; // tarifaHoraManoObra no configurada en el seed base
      await tx.loteGranel.update({
        where: { id: lote.id },
        data: {
          costoInsumos,
          kgProducidos,
          mermaKg: Math.max(0, kgObjetivo - kgProducidos),
          horasManoObra: horas,
          costoManoObra,
          costoKg: (costoInsumos + costoManoObra) / kgProducidos,
          kgDisponibles: kgProducidos,
          estado: "APROBADO",
          fechaFin: new Date(),
        },
      });
      await tx.controlCalidad.create({
        data: { loteGranelId: lote.id, resultado: "APROBADO", ...audit },
      });

      return tx.loteGranel.findUniqueOrThrow({ where: { id: lote.id } });
    });
  }

  const lote1 = await producirLote(100, 96, 8);
  const lote2 = await producirLote(200, 190, 14);
  const lote3 = await producirLote(150, 145, 11);
  console.log("Lotes granel producidos y aprobados por calidad.");

  // ------------------------------------------------- 5. Envasados
  async function envasar(
    lote: Awaited<ReturnType<typeof producirLote>>,
    presentacionId: string,
    unidades: number,
    envaseInsumoId: string
  ) {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoEnvasado(tx);
      const presentacion = await tx.presentacion.findUniqueOrThrow({ where: { id: presentacionId } });
      const kgConsumidos = unidades * presentacion.contenidoKg.toNumber();

      const envasado = await tx.envasado.create({
        data: {
          codigo,
          loteGranelId: lote.id,
          presentacionId,
          unidades,
          unidadesDisponibles: unidades,
          kgConsumidos,
          ...audit,
          insumos: {
            create: [
              { insumoId: envaseInsumoId, cantidad: unidades },
              { insumoId: etqChasis.id, cantidad: unidades },
            ],
          },
        },
      });

      let costoEnvases = 0;
      for (const [insumoId, cantidad] of [
        [envaseInsumoId, unidades],
        [etqChasis.id, unidades],
      ] as const) {
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId } });
        costoEnvases += cantidad * insumo.costoUnitario.toNumber();
        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId,
          tipoMovimiento: "SALIDA",
          origen: "ENVASADO",
          cantidad,
          referencia: `Envasado ${codigo} (lote ${lote.codigo})`,
          ...audit,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      const costoKgLote = lote.costoKg.toNumber();
      const costoTotal = kgConsumidos * costoKgLote + costoEnvases;
      const costoUnitario = costoTotal / unidades;

      const stockAntes = presentacion.stock.toNumber();
      const costoPromAntes = presentacion.costoPromedio.toNumber();
      const nuevoCostoPromedio =
        (stockAntes * costoPromAntes + unidades * costoUnitario) / (stockAntes + unidades);

      await tx.envasado.update({
        where: { id: envasado.id },
        data: { costoTotal, costoUnitario },
      });
      await tx.presentacion.update({
        where: { id: presentacionId },
        data: { costoPromedio: nuevoCostoPromedio },
      });

      const entrada = await registrarMovimiento(tx, {
        tipoItem: "PRESENTACION",
        presentacionId,
        tipoMovimiento: "ENTRADA",
        origen: "ENVASADO",
        cantidad: unidades,
        referencia: `Envasado ${codigo} (lote ${lote.codigo})`,
        ...audit,
      });
      if (!entrada.ok) throw new Error(entrada.error);

      await tx.loteGranel.update({
        where: { id: lote.id },
        data: { kgDisponibles: lote.kgDisponibles.toNumber() - kgConsumidos },
      });
    });
  }

  await envasar(lote1, presPote.id, 120, envPote.id);
  await envasar(lote2, presBalde.id, 11, envBalde.id);
  await envasar(lote3, presPote.id, 80, envPote.id);
  console.log("Envasados registrados: stock de presentaciones actualizado con su costo real.");

  // --------------------------------------------- 6. Ventas (últimos 6 meses)
  type Venta = {
    mesesAtras: number;
    dia: number;
    cliente: (typeof carteraClientes)[number];
    condicionPago: keyof typeof DIAS_CONDICION;
    lineas: { presentacion: typeof presPote; cantidad: number }[];
    cobro: "TOTAL" | "PARCIAL" | "NINGUNO";
  };

  const ventas: Venta[] = [
    { mesesAtras: 5, dia: 6, cliente: carteraClientes[0], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 10 }], cobro: "TOTAL" },
    { mesesAtras: 5, dia: 18, cliente: carteraClientes[2], condicionPago: "DIAS_15", lineas: [{ presentacion: presPote, cantidad: 15 }, { presentacion: presBalde, cantidad: 1 }], cobro: "TOTAL" },
    { mesesAtras: 4, dia: 4, cliente: carteraClientes[1], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 8 }], cobro: "TOTAL" },
    { mesesAtras: 4, dia: 20, cliente: carteraClientes[3], condicionPago: "DIAS_30", lineas: [{ presentacion: presPote, cantidad: 20 }], cobro: "TOTAL" },
    { mesesAtras: 3, dia: 9, cliente: carteraClientes[4], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 12 }, { presentacion: presBalde, cantidad: 1 }], cobro: "TOTAL" },
    { mesesAtras: 3, dia: 22, cliente: carteraClientes[0], condicionPago: "DIAS_15", lineas: [{ presentacion: presPote, cantidad: 9 }], cobro: "TOTAL" },
    { mesesAtras: 2, dia: 5, cliente: carteraClientes[2], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 14 }], cobro: "TOTAL" },
    { mesesAtras: 2, dia: 17, cliente: carteraClientes[1], condicionPago: "DIAS_30", lineas: [{ presentacion: presPote, cantidad: 18 }, { presentacion: presBalde, cantidad: 1 }], cobro: "PARCIAL" },
    { mesesAtras: 1, dia: 3, cliente: carteraClientes[3], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 11 }], cobro: "TOTAL" },
    { mesesAtras: 1, dia: 15, cliente: carteraClientes[4], condicionPago: "DIAS_15", lineas: [{ presentacion: presPote, cantidad: 16 }], cobro: "PARCIAL" },
    { mesesAtras: 1, dia: 26, cliente: carteraClientes[0], condicionPago: "CONTADO", lineas: [{ presentacion: presBalde, cantidad: 1 }], cobro: "TOTAL" },
    { mesesAtras: 0, dia: 2, cliente: carteraClientes[2], condicionPago: "DIAS_30", lineas: [{ presentacion: presPote, cantidad: 13 }], cobro: "NINGUNO" },
    { mesesAtras: 0, dia: 10, cliente: carteraClientes[1], condicionPago: "CONTADO", lineas: [{ presentacion: presPote, cantidad: 10 }], cobro: "TOTAL" },
    { mesesAtras: 0, dia: 16, cliente: carteraClientes[3], condicionPago: "DIAS_15", lineas: [{ presentacion: presPote, cantidad: 17 }], cobro: "NINGUNO" },
  ];

  for (const venta of ventas) {
    const fechaEmision = fechaHace(venta.mesesAtras, venta.dia);
    if (fechaEmision > hoy) continue; // por si el mes actual no llegó a ese día todavía

    await prisma.$transaction(async (tx) => {
      const numeroPedido = await siguienteNumeroPedido(tx);
      const total = venta.lineas.reduce(
        (acc, l) => acc + l.cantidad * l.presentacion.precio.toNumber(),
        0
      );
      const pedido = await tx.pedido.create({
        data: {
          numero: numeroPedido,
          clienteId: venta.cliente.id,
          vendedorId: venta.cliente.vendedorId,
          fecha: fechaEmision,
          estado: "FACTURADO",
          total,
          ...audit,
          detalles: {
            create: venta.lineas.map((l) => ({
              presentacionId: l.presentacion.id,
              cantidad: l.cantidad,
              precioUnitario: l.presentacion.precio,
              subtotal: l.cantidad * l.presentacion.precio.toNumber(),
            })),
          },
        },
      });

      correlativoFactura += 1;
      const numeroFactura = formatearNumeroSerie(serieFactura.serie, correlativoFactura);
      const subtotal = total;
      const igv = Math.round(subtotal * 18) / 100;
      const totalConIgv = subtotal + igv;
      const fechaVencimiento = new Date(
        fechaEmision.getTime() + DIAS_CONDICION[venta.condicionPago] * 24 * 60 * 60 * 1000
      );

      let costoVentas = 0;
      const detallesPedido = await tx.pedidoDetalle.findMany({ where: { pedidoId: pedido.id } });
      for (const d of detallesPedido) {
        const presentacion = await tx.presentacion.findUniqueOrThrow({ where: { id: d.presentacionId } });
        costoVentas += d.cantidad * presentacion.costoPromedio.toNumber();
        await tx.pedidoDetalle.update({
          where: { id: d.id },
          data: { costoUnitario: presentacion.costoPromedio },
        });
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: d.presentacionId,
          tipoMovimiento: "SALIDA",
          origen: "VENTA",
          cantidad: d.cantidad,
          referencia: `Factura ${numeroFactura} (pedido ${numeroPedido})`,
          ...audit,
        });
        if (!mov.ok) throw new Error(mov.error);

        await asignarLoteVenta(tx, {
          pedidoDetalleId: d.id,
          presentacionId: d.presentacionId,
          cantidad: d.cantidad,
        });
      }

      const montoInicial = venta.cobro === "NINGUNO" ? 0 : venta.cobro === "PARCIAL" ? totalConIgv * 0.5 : totalConIgv;
      const factura = await tx.factura.create({
        data: {
          numero: numeroFactura,
          pedidoId: pedido.id,
          clienteId: venta.cliente.id,
          vendedorId: venta.cliente.vendedorId,
          condicionPago: venta.condicionPago,
          fechaEmision,
          fechaVencimiento,
          subtotal,
          tasaIgv: 18,
          igv,
          total: totalConIgv,
          saldo: totalConIgv - montoInicial,
          estado: montoInicial >= totalConIgv - 1e-6 ? "PAGADA" : "PENDIENTE",
          ...audit,
        },
      });

      const tasa = (await tx.vendedor.findUniqueOrThrow({ where: { id: venta.cliente.vendedorId } })).tasaComision.toNumber();
      await tx.comision.create({
        data: {
          vendedorId: venta.cliente.vendedorId,
          facturaId: factura.id,
          tipo: "GENERADA",
          tasa,
          monto: (subtotal * tasa) / 100,
        },
      });

      await avanzarSerie(tx, serieFactura.id);

      await postearVenta(
        tx,
        {
          numeroFactura,
          cliente: venta.cliente.razonSocial,
          subtotal,
          igv,
          total: totalConIgv,
          costoVentas,
          fecha: fechaEmision,
        },
        audit
      );

      if (montoInicial > 0) {
        await tx.cobro.create({
          data: {
            facturaId: factura.id,
            monto: montoInicial,
            medioPago: "TRANSFERENCIA",
            fecha: fechaEmision,
            ...audit,
          },
        });
        await tx.movimientoCaja.create({
          data: {
            tipo: "INGRESO",
            concepto: `Cobro factura ${numeroFactura}`,
            monto: montoInicial,
            medioPago: "TRANSFERENCIA",
            referencia: numeroFactura,
            fecha: fechaEmision,
            ...audit,
          },
        });
        await postearCobro(tx, { numeroFactura, monto: montoInicial, fecha: fechaEmision }, audit);
      }
    });
  }
  console.log(`Ventas registradas: ${ventas.length} pedidos facturados en los últimos 6 meses.`);

  // ------------------------------------------------- 7. Nota de crédito
  const facturaParaNC = await prisma.factura.findFirst({
    where: { clienteId: carteraClientes[0].id },
    orderBy: { fechaEmision: "desc" },
    include: { notasCredito: true },
  });
  if (facturaParaNC) {
    await prisma.$transaction(async (tx) => {
      const montoNC = Math.min(20, facturaParaNC.total.toNumber() * 0.15);
      await tx.notaCredito.create({
        data: {
          numero: "FC01-00000001",
          facturaId: facturaParaNC.id,
          monto: montoNC,
          motivo: "Descuento comercial por pronto pago",
          ...audit,
        },
      });
      await tx.factura.update({
        where: { id: facturaParaNC.id },
        data: { saldo: Math.max(0, facturaParaNC.saldo.toNumber() - montoNC) },
      });
      const montoBase = montoNC / 1.18;
      await postearNotaCredito(
        tx,
        {
          numeroNC: "FC01-00000001",
          numeroFactura: facturaParaNC.numero,
          montoBase,
          montoIgv: montoNC - montoBase,
          montoTotal: montoNC,
        },
        audit
      );
    });
    console.log("Nota de crédito de ejemplo registrada.");
  }

  // ------------------------------------------------- 8. Activos fijos
  const planta = await prisma.almacen.findUniqueOrThrow({
    where: { empresaId_codigo: { empresaId: "1", codigo: "PLANTA" } },
  });

  type ActivoSeed = {
    nombre: string;
    categoria: $Enums.CategoriaActivoFijo;
    mesesAntiguedad: number;
    costo: number;
    residual: number;
    vidaUtilAnios: number;
  };
  const activosSeed: ActivoSeed[] = [
    {
      nombre: "Mezcladora de grasas MG-500",
      categoria: "MAQUINARIA",
      mesesAntiguedad: 24,
      costo: 45000,
      residual: 4500,
      vidaUtilAnios: 10,
    },
    {
      nombre: "Camioneta de reparto Hyundai H100",
      categoria: "VEHICULO",
      mesesAntiguedad: 14,
      costo: 68000,
      residual: 8000,
      vidaUtilAnios: 5,
    },
    {
      nombre: "Laptop administrativa Dell Latitude",
      categoria: "EQUIPO_OFICINA",
      mesesAntiguedad: 8,
      costo: 4200,
      residual: 200,
      vidaUtilAnios: 4,
    },
  ];

  // Simula haber corrido "Registrar depreciación" cada mes desde la compra: un
  // asiento consolidado por mes (mismo comportamiento que registrarDepreciacionMes).
  const cargosPorMes = new Map<string, number>();
  const activoFijoPorNombre = new Map<string, string>();
  for (const a of activosSeed) {
    const fechaAdquisicion = fechaHace(a.mesesAntiguedad, 1);
    const cuotaMensual = (a.costo - a.residual) / (a.vidaUtilAnios * 12);

    const activoFijo = await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoActivoFijo(tx);
      return tx.activoFijo.create({
        data: {
          codigo,
          nombre: a.nombre,
          categoria: a.categoria,
          almacenId: planta.id,
          fechaAdquisicion,
          costoAdquisicion: a.costo,
          valorResidual: a.residual,
          vidaUtilAnios: a.vidaUtilAnios,
          ...audit,
        },
      });
    });

    let acumulada = 0;
    const mesesACargar = Math.min(a.mesesAntiguedad, a.vidaUtilAnios * 12);
    for (let k = mesesACargar; k >= 1; k--) {
      const pendiente = a.costo - a.residual - acumulada;
      const cargo = Math.min(cuotaMensual, pendiente);
      if (cargo <= 0.01) break;
      const fecha = fechaHace(k, 1);
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      await prisma.depreciacionActivo.create({
        data: { activoFijoId: activoFijo.id, anio, mes, monto: cargo },
      });
      acumulada += cargo;
      const clave = `${anio}-${mes}`;
      cargosPorMes.set(clave, (cargosPorMes.get(clave) ?? 0) + cargo);
    }
    await prisma.activoFijo.update({
      where: { id: activoFijo.id },
      data: { depreciacionAcumulada: acumulada },
    });
    activoFijoPorNombre.set(a.nombre, activoFijo.id);
  }

  const clavesOrdenadas = [...cargosPorMes.keys()].sort((a, b) => {
    const [aAnio, aMes] = a.split("-").map(Number);
    const [bAnio, bMes] = b.split("-").map(Number);
    return aAnio - bAnio || aMes - bMes;
  });
  for (const clave of clavesOrdenadas) {
    const [anio, mes] = clave.split("-").map(Number);
    const monto = Math.round(cargosPorMes.get(clave)! * 100) / 100;
    await prisma.$transaction(async (tx) => {
      await postearDepreciacion(tx, { anio, mes, monto }, audit);
    });
  }
  console.log(`Activos fijos creados: ${activosSeed.length}, con historial de depreciación mensual.`);

  // ------------------------------------------- 9. Equipos y mantenimiento
  const mezcladora = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoEquipo(tx);
    return tx.equipo.create({
      data: {
        codigo,
        nombre: "Mezcladora de grasas MG-500",
        almacenId: planta.id,
        activoFijoId: activoFijoPorNombre.get("Mezcladora de grasas MG-500"),
      },
    });
  });
  const camioneta = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoEquipo(tx);
    return tx.equipo.create({
      data: {
        codigo,
        nombre: "Camioneta de reparto Hyundai H100",
        almacenId: planta.id,
        activoFijoId: activoFijoPorNombre.get("Camioneta de reparto Hyundai H100"),
      },
    });
  });

  // Orden correctiva ya completada (con costo posteado a contabilidad y caja).
  await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoOrdenMantenimiento(tx);
    const fechaProgramada = fechaHace(2, 10);
    const costoManoObra = 180;
    const costoRepuestos = 320;
    await tx.ordenMantenimiento.create({
      data: {
        codigo,
        equipoId: mezcladora.id,
        tipo: "CORRECTIVO",
        estado: "COMPLETADA",
        descripcion: "Fuga de aceite en el sistema hidráulico de la mezcladora.",
        fechaProgramada,
        fechaInicio: fechaProgramada,
        fechaFin: fechaProgramada,
        costoManoObra,
        costoRepuestos,
        observaciones: "Se cambiaron los retenes hidráulicos y se purgó el circuito.",
        ...audit,
      },
    });
    const total = costoManoObra + costoRepuestos;
    await tx.movimientoCaja.create({
      data: {
        tipo: "EGRESO",
        concepto: `Mantenimiento ${codigo} — ${mezcladora.nombre}`,
        monto: total,
        medioPago: "EFECTIVO",
        referencia: codigo,
        fecha: fechaProgramada,
        ...audit,
      },
    });
    await postearMantenimiento(
      tx,
      { codigoOrden: codigo, equipo: mezcladora.nombre, monto: total, fecha: fechaProgramada },
      audit
    );
  });

  // Orden preventiva programada a futuro (demuestra el bloqueo de calendario
  // si el almacén ya tiene CalendarioProduccion configurado).
  await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoOrdenMantenimiento(tx);
    const fechaProgramada = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 5);
    await tx.ordenMantenimiento.create({
      data: {
        codigo,
        equipoId: camioneta.id,
        tipo: "PREVENTIVO",
        descripcion: "Mantenimiento preventivo de 20,000 km: aceite, filtros y frenos.",
        fechaProgramada,
        duracionDias: 1,
        ...audit,
      },
    });
    const calendario = await tx.calendarioProduccion.findUnique({ where: { almacenId: planta.id } });
    if (calendario) {
      await tx.diaNoLaborable.upsert({
        where: { calendarioId_fecha: { calendarioId: calendario.id, fecha: fechaProgramada } },
        update: {},
        create: { calendarioId: calendario.id, fecha: fechaProgramada, motivo: `Mantenimiento ${codigo}` },
      });
    }
  });
  console.log("Equipos y órdenes de mantenimiento de ejemplo creados.");

  console.log("Datos de prueba cargados. Ya podés navegar el ERP con información real.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
