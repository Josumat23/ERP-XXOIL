// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  siguienteNumeroCotizacion,
  siguienteNumeroPedido,
  siguienteNumeroHojaRuta,
  siguienteNumeroRfq,
  siguienteNumeroOrdenCompra,
  siguienteNumeroAcuerdoSuministro,
} from "../src/lib/correlativos";
import { cantidadLiberable } from "../src/lib/acuerdosSuministro";
import { obtenerConfiguracionEmpresa } from "../src/lib/empresa";
import { pasosAplicablesCompra } from "../src/lib/aprobacionesCompra";

// ---------------------------------------------------------------------------
// Cuatro pantallas que se podían abrir y no se podían estrenar.
//
// Cotizaciones, hojas de ruta, RFQ y acuerdos de suministro estaban en cero en
// la demo: la pantalla cargaba, decía «no hay registros» y ahí terminaba. No
// se podía ver de qué sirve ninguna de las cuatro.
//
// Lo que se siembra no es «una fila por tabla». Cada pantalla existe para
// contestar algo, y una fila sola no alcanza para contestarlo:
//
//   — el EMBUDO de ventas compara cotizaciones en distintos estados y con
//     distinta probabilidad: con una sola no hay embudo;
//   — «comparación de ofertas» de un RFQ necesita DOS ofertas, y el sistema lo
//     exige: adjudicar con una sola está prohibido;
//   — un acuerdo de suministro se entiende cuando está PARCIALMENTE liberado,
//     porque lo que muestra la pantalla es el saldo contractual;
//   — una hoja de ruta cerrada, al lado de una planificada, es lo que enseña
//     para qué sirve el campo «resultado».
//
// SEGREGACIÓN DE FUNCIONES. El sistema prohíbe que quien solicita un RFQ sea
// quien lo adjudica. El RFQ adjudicado de acá respeta esa regla —lo pide
// Almacén y lo adjudica Gerencia— en vez de esquivarla escribiendo la fila
// directamente: si el dato de prueba no la cumpliera, la pantalla mostraría
// una adjudicación que el sistema nunca habría aceptado.
//
// Todo es INVENTADO y para ambiente de prueba. Los precios, los plazos y las
// razones sociales no salen de ningún dato real de XXOIL.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: crearAdaptador() });

const HOY = new Date();
/** Fecha a N días de hoy (negativo hacia atrás), a medianoche local. */
function dia(n: number): Date {
  const f = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n);
  return f;
}

type Actor = { id: string; nombre: string };

async function sembrarCotizaciones(
  empresaId: string,
  ventas: Actor,
  clientes: { id: string; razonSocial: string }[],
  vendedores: { id: string }[],
  presentaciones: { id: string; nombre: string; precioLista: number }[]
) {
  // Cuatro estados distintos para que el embudo tenga de qué hablar. La
  // probabilidad es la estimación del vendedor mientras la cotización sigue
  // pendiente; al cerrarse, el propio sistema la fija en 100 o en 0.
  const plan = [
    {
      cliente: 0,
      vendedor: 0,
      estado: "PENDIENTE" as const,
      probabilidad: 75,
      dias: 20,
      notas: "Pedido recurrente trimestral. Piden mantener el precio del trimestre anterior.",
      lineas: [
        { p: 0, cantidad: 40 },
        { p: 1, cantidad: 24 },
      ],
    },
    {
      cliente: 1,
      vendedor: 1,
      estado: "PENDIENTE" as const,
      probabilidad: 30,
      dias: 12,
      notas: "Primer contacto. Están comparando con dos proveedores más.",
      lineas: [{ p: 2, cantidad: 60 }],
    },
    {
      cliente: 2,
      vendedor: 0,
      estado: "RECHAZADA" as const,
      probabilidad: 0,
      dias: -8,
      notas: "Rechazada por precio: el cliente consiguió 12% menos con otro proveedor.",
      lineas: [{ p: 0, cantidad: 100 }],
    },
    {
      cliente: 3,
      vendedor: 1,
      estado: "ACEPTADA" as const,
      probabilidad: 100,
      dias: 15,
      notas: "Aceptada por correo. Falta que emitan su orden de compra.",
      lineas: [{ p: 1, cantidad: 30 }],
    },
  ];

  const creadas: { id: string; numero: string }[] = [];
  for (const c of plan) {
    const lineas = c.lineas.map((l) => ({
      presentacionId: presentaciones[l.p % presentaciones.length].id,
      cantidad: l.cantidad,
      precioUnitario: presentaciones[l.p % presentaciones.length].precioLista,
    }));
    const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
    const cot = await prisma.$transaction(async (tx) => {
      const numero = await siguienteNumeroCotizacion(tx, empresaId);
      return tx.cotizacion.create({
        data: {
          empresaId,
          numero,
          clienteId: clientes[c.cliente % clientes.length].id,
          vendedorId: vendedores[c.vendedor % vendedores.length].id,
          fecha: dia(-14),
          validaHasta: dia(c.dias),
          estado: c.estado,
          probabilidad: c.probabilidad,
          total,
          notas: c.notas,
          usuarioId: ventas.id,
          usuarioNombre: ventas.nombre,
          detalles: {
            create: lineas.map((l) => ({
              presentacionId: l.presentacionId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              subtotal: l.cantidad * l.precioUnitario,
            })),
          },
        },
        select: { id: true, numero: true },
      });
    });
    creadas.push(cot);
  }

  // Y una quinta que recorre el camino completo: cotización → pedido. La
  // conversión RESERVA stock, igual que la acción real; por eso las cantidades
  // son chicas y se comprueba la disponibilidad antes, para no dejar a la demo
  // con stock comprometido que nadie pidió.
  const presentacion = presentaciones[0];
  const cantidad = 12;
  const disponible = await prisma.presentacion.findUniqueOrThrow({
    where: { id: presentacion.id },
    select: { stock: true, stockReservado: true },
  });
  const libre = disponible.stock.toNumber() - disponible.stockReservado.toNumber();
  if (libre < cantidad) {
    console.log(
      `[comercial] Sin stock libre de "${presentacion.nombre}" (${libre}): no se siembra la cotización convertida.`
    );
    return creadas;
  }

  const convertida = await prisma.$transaction(async (tx) => {
    const numeroCot = await siguienteNumeroCotizacion(tx, empresaId);
    const total = cantidad * presentacion.precioLista;
    const cot = await tx.cotizacion.create({
      data: {
        empresaId,
        numero: numeroCot,
        clienteId: clientes[4 % clientes.length].id,
        vendedorId: vendedores[0].id,
        fecha: dia(-21),
        validaHasta: dia(9),
        estado: "ACEPTADA",
        probabilidad: 100,
        total,
        notas: "Aceptada y convertida a pedido.",
        usuarioId: ventas.id,
        usuarioNombre: ventas.nombre,
        detalles: {
          create: [
            {
              presentacionId: presentacion.id,
              cantidad,
              precioUnitario: presentacion.precioLista,
              subtotal: total,
            },
          ],
        },
      },
      select: { id: true, numero: true, clienteId: true, vendedorId: true, total: true },
    });

    // Reservar es lo que hace la conversión real: sin esto el pedido existiría
    // pero el inventario no sabría que esas unidades ya están comprometidas.
    await tx.presentacion.update({
      where: { id: presentacion.id, empresaId },
      data: { stockReservado: { increment: cantidad } },
    });

    const numeroPed = await siguienteNumeroPedido(tx, empresaId);
    const pedido = await tx.pedido.create({
      data: {
        empresaId,
        numero: numeroPed,
        clienteId: cot.clienteId,
        vendedorId: cot.vendedorId,
        total: cot.total,
        notas: `Desde cotización ${cot.numero}`,
        usuarioId: ventas.id,
        usuarioNombre: ventas.nombre,
        detalles: {
          create: [
            {
              presentacionId: presentacion.id,
              cantidad,
              precioUnitario: presentacion.precioLista,
              subtotal: total,
            },
          ],
        },
      },
      select: { id: true, numero: true },
    });

    await tx.cotizacion.update({
      where: { id: cot.id },
      data: { estado: "CONVERTIDA", pedidoId: pedido.id },
    });
    return { id: cot.id, numero: cot.numero, pedido: pedido.numero };
  });

  console.log(`[comercial] ${convertida.numero} convertida en el pedido ${convertida.pedido}.`);
  return [...creadas, convertida];
}

async function sembrarHojasDeRuta(
  empresaId: string,
  ventas: Actor,
  clientes: { id: string; razonSocial: string }[],
  vendedores: { id: string }[]
) {
  // Una planificada y una cerrada. La cerrada es la que enseña para qué sirve
  // el campo «resultado»: sin una hoja completada, la mitad de la pantalla no
  // se entiende.
  const planificada = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroHojaRuta(tx, empresaId);
    return tx.hojaRuta.create({
      data: {
        empresaId,
        numero,
        vendedorId: vendedores[0].id,
        fecha: dia(1),
        estado: "PLANIFICADA",
        notas: "Zona norte. Salir 7:30 desde planta.",
        usuarioId: ventas.id,
        usuarioNombre: ventas.nombre,
        visitas: {
          create: [
            { clienteId: clientes[0].id, orden: 1, objetivo: "Cobrar la factura vencida" },
            { clienteId: clientes[1].id, orden: 2, objetivo: "Presentar la grasa EP-2 nueva" },
            { clienteId: clientes[2].id, orden: 3, objetivo: "Recoger cascos vacíos" },
          ],
        },
      },
      select: { id: true, numero: true },
    });
  });

  const completada = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroHojaRuta(tx, empresaId);
    return tx.hojaRuta.create({
      data: {
        empresaId,
        numero,
        vendedorId: vendedores[1 % vendedores.length].id,
        fecha: dia(-4),
        estado: "COMPLETADA",
        notas: "Zona sur.",
        usuarioId: ventas.id,
        usuarioNombre: ventas.nombre,
        visitas: {
          create: [
            {
              clienteId: clientes[3 % clientes.length].id,
              orden: 1,
              objetivo: "Cobrar la factura vencida",
              resultado: "Pagaron el 60%. El saldo queda para fin de mes.",
            },
            {
              clienteId: clientes[4 % clientes.length].id,
              orden: 2,
              objetivo: "Ofrecer aceite hidráulico ISO 68",
              resultado: "Pidieron cotización formal por 200 galones.",
            },
            {
              clienteId: clientes[0].id,
              orden: 3,
              objetivo: "Revisar reclamo de viscosidad",
              resultado: "No había nadie del área técnica. Reprogramar.",
            },
          ],
        },
      },
      select: { id: true, numero: true },
    });
  });

  console.log(
    `[comercial] Hojas de ruta ${planificada.numero} (planificada) y ${completada.numero} (completada).`
  );
}

async function sembrarRfq(
  empresaId: string,
  almacen: Actor,
  gerencia: Actor,
  insumos: { id: string; nombre: string }[],
  proveedores: { id: string; razonSocial: string }[]
) {
  if (proveedores.length < 2) {
    console.log("[compras] Hacen falta dos proveedores activos para un RFQ comparable. Se omite.");
    return;
  }

  // 1) Un RFQ ABIERTO con dos ofertas: es exactamente lo que la pantalla
  //    «comparación de ofertas» existe para mostrar. La más barata no es la de
  //    menor plazo, para que la comparación tenga algo que decidir.
  const lineasAbierto = [
    { insumo: insumos[0], cantidad: 400 },
    { insumo: insumos[1 % insumos.length], cantidad: 150 },
  ];
  const abierto = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroRfq(tx, empresaId);
    const rfq = await tx.rfqCompra.create({
      data: {
        empresaId,
        numero,
        titulo: "Base lubricante y aditivo para el trimestre",
        fechaLimite: dia(6),
        estado: "ABIERTO",
        usuarioId: almacen.id,
        usuarioNombre: almacen.nombre,
        lineas: {
          create: lineasAbierto.map((l) => ({ insumoId: l.insumo.id, cantidad: l.cantidad })),
        },
      },
      include: { lineas: true },
    });

    const precios = [
      { proveedor: proveedores[0], factor: 1.0, plazo: 12, pago: 30, nota: "Precio firme por 30 días." },
      { proveedor: proveedores[1], factor: 0.94, plazo: 25, pago: 15, nota: "Más barato pero entrega a 25 días." },
    ];
    for (const of of precios) {
      const lineas = rfq.lineas.map((l, i) => {
        const base = [18.4, 42.75][i % 2];
        const costoUnitario = Number((base * of.factor).toFixed(4));
        return {
          rfqLineaId: l.id,
          costoUnitario,
          subtotal: Number((costoUnitario * l.cantidad.toNumber()).toFixed(4)),
        };
      });
      await tx.ofertaRfq.create({
        data: {
          rfqId: rfq.id,
          proveedorId: of.proveedor.id,
          moneda: "PEN",
          tipoCambio: 1,
          condicionPagoDias: of.pago,
          plazoEntregaDias: of.plazo,
          total: lineas.reduce((acc, l) => acc + l.subtotal, 0),
          estado: "PRESENTADA",
          notas: of.nota,
          usuarioId: almacen.id,
          usuarioNombre: almacen.nombre,
          lineas: { create: lineas },
        },
      });
    }
    return { numero: rfq.numero };
  });

  // 2) Un RFQ ADJUDICADO, con su orden de compra.
  //
  //    Lo solicita Almacén y lo adjudica GERENCIA porque el sistema prohíbe
  //    que quien pide sea quien adjudica. Sembrar una adjudicación que viole
  //    esa regla mostraría en pantalla algo que la aplicación nunca habría
  //    aceptado.
  const adjudicado = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroRfq(tx, empresaId);
    const rfq = await tx.rfqCompra.create({
      data: {
        empresaId,
        numero,
        titulo: "Envases de 5 galones — reposición",
        fechaLimite: dia(-10),
        estado: "ABIERTO",
        usuarioId: almacen.id,
        usuarioNombre: almacen.nombre,
        lineas: { create: [{ insumoId: insumos[2 % insumos.length].id, cantidad: 500 }] },
      },
      include: { lineas: true },
    });

    const ofertas = [];
    for (const [i, proveedor] of proveedores.slice(0, 2).entries()) {
      const costoUnitario = [7.9, 8.35][i];
      const linea = rfq.lineas[0];
      ofertas.push(
        await tx.ofertaRfq.create({
          data: {
            rfqId: rfq.id,
            proveedorId: proveedor.id,
            moneda: "PEN",
            tipoCambio: 1,
            condicionPagoDias: 30,
            plazoEntregaDias: 10 + i * 5,
            total: Number((costoUnitario * linea.cantidad.toNumber()).toFixed(4)),
            estado: "PRESENTADA",
            usuarioId: almacen.id,
            usuarioNombre: almacen.nombre,
            lineas: {
              create: [
                {
                  rfqLineaId: linea.id,
                  costoUnitario,
                  subtotal: Number((costoUnitario * linea.cantidad.toNumber()).toFixed(4)),
                },
              ],
            },
          },
          include: { lineas: { include: { rfqLinea: true } } },
        })
      );
    }

    const ganadora = ofertas[0];
    const justificacion =
      "Menor precio unitario y plazo de entrega dentro de la necesidad de producción.";
    await tx.ofertaRfq.updateMany({ where: { rfqId: rfq.id }, data: { estado: "NO_SELECCIONADA" } });
    await tx.ofertaRfq.update({ where: { id: ganadora.id }, data: { estado: "ADJUDICADA" } });

    const numeroOc = await siguienteNumeroOrdenCompra(tx, empresaId);
    const configuracion = await obtenerConfiguracionEmpresa(empresaId, tx);
    const pasos = await pasosAplicablesCompra(
      tx,
      empresaId,
      ganadora.total.toNumber(),
      configuracion.montoAprobacionCompras.toNumber()
    );
    const fechaEntrega = dia(ganadora.plazoEntregaDias - 10);
    const orden = await tx.ordenCompra.create({
      data: {
        empresaId,
        numero: numeroOc,
        proveedorId: ganadora.proveedorId,
        moneda: "PEN",
        tipoCambio: 1,
        total: ganadora.total,
        rfqId: rfq.id,
        notas: `Generada desde ${rfq.numero}. ${justificacion}`,
        estadoAprobacion: pasos.length ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: gerencia.id,
        usuarioNombre: gerencia.nombre,
        detalles: {
          create: ganadora.lineas.map((l) => ({
            insumoId: l.rfqLinea.insumoId,
            cantidad: l.rfqLinea.cantidad,
            costoUnitario: l.costoUnitario,
            subtotal: l.subtotal,
            fechaEntregaEsperada: fechaEntrega,
          })),
        },
        pasosAprobacion: { create: pasos },
      },
      select: { numero: true },
    });

    await tx.rfqCompra.update({
      where: { id: rfq.id },
      data: {
        estado: "ADJUDICADO",
        justificacionAdjudicacion: justificacion,
        adjudicadaEn: dia(-9),
        adjudicadaPorId: gerencia.id,
        adjudicadaPorNombre: gerencia.nombre,
      },
    });
    return { numero: rfq.numero, orden: orden.numero };
  });

  console.log(
    `[compras] RFQ ${abierto.numero} abierto con 2 ofertas; ${adjudicado.numero} adjudicado → ${adjudicado.orden}.`
  );
}

async function sembrarAcuerdoSuministro(
  empresaId: string,
  almacen: Actor,
  insumos: { id: string; nombre: string }[],
  proveedores: { id: string; razonSocial: string }[]
) {
  // Un acuerdo se entiende cuando está PARCIALMENTE liberado: lo que la
  // pantalla muestra es el saldo contractual, y con cero liberado no hay saldo
  // que mirar. Así que además del acuerdo se libera una parte, que es lo que
  // genera una orden de compra contra el contrato.
  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroAcuerdoSuministro(tx, empresaId);
    const lineas = [
      { insumoId: insumos[0].id, cantidadComprometida: 2400, precioUnitario: 17.8 },
      { insumoId: insumos[1 % insumos.length].id, cantidadComprometida: 600, precioUnitario: 41.2 },
    ];
    const acuerdo = await tx.acuerdoSuministro.create({
      data: {
        empresaId,
        numero,
        proveedorId: proveedores[0].id,
        titulo: "Base lubricante — precio firme por seis meses",
        moneda: "PEN",
        tipoCambio: 1,
        vigenteDesde: dia(-45),
        vigenteHasta: dia(135),
        estado: "ACTIVO",
        usuarioId: almacen.id,
        usuarioNombre: almacen.nombre,
        lineas: { create: lineas },
      },
      include: { lineas: true },
    });

    // Se libera un tercio de la primera línea. `cantidadLiberable` es la misma
    // regla que usa la acción real: si la liberación superara el saldo, esto
    // se cae acá en vez de dejar un acuerdo imposible en la demo.
    const linea = acuerdo.lineas[0];
    const aLiberar = 800;
    if (
      !cantidadLiberable(
        linea.cantidadComprometida.toNumber(),
        linea.cantidadLiberada.toNumber(),
        aLiberar
      )
    ) {
      throw new Error("La liberación de prueba supera el saldo contractual.");
    }
    await tx.acuerdoSuministroLinea.update({
      where: { id: linea.id },
      data: { cantidadLiberada: { increment: aLiberar } },
    });

    const total = aLiberar * linea.precioUnitario.toNumber();
    const numeroOc = await siguienteNumeroOrdenCompra(tx, empresaId);
    const configuracion = await obtenerConfiguracionEmpresa(empresaId, tx);
    const pasos = await pasosAplicablesCompra(
      tx,
      empresaId,
      total,
      configuracion.montoAprobacionCompras.toNumber()
    );
    const orden = await tx.ordenCompra.create({
      data: {
        empresaId,
        numero: numeroOc,
        proveedorId: acuerdo.proveedorId,
        acuerdoId: acuerdo.id,
        moneda: "PEN",
        tipoCambio: 1,
        total,
        notas: `Liberación de ${acuerdo.numero}`,
        estadoAprobacion: pasos.length ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: almacen.id,
        usuarioNombre: almacen.nombre,
        detalles: {
          create: [
            {
              insumoId: linea.insumoId,
              acuerdoLineaId: linea.id,
              cantidad: aLiberar,
              costoUnitario: linea.precioUnitario,
              subtotal: total,
              fechaEntregaEsperada: dia(12),
            },
          ],
        },
        pasosAprobacion: { create: pasos },
      },
      select: { numero: true },
    });
    return { numero: acuerdo.numero, orden: orden.numero, liberado: aLiberar };
  });

  console.log(
    `[compras] Acuerdo ${resultado.numero}: ${resultado.liberado} liberados → ${resultado.orden}.`
  );
}

async function main() {
  const empresa = await prisma.empresa.findFirstOrThrow({
    where: { esPrincipal: true },
    select: { id: true },
  });
  const empresaId = empresa.id;

  // Idempotente: si ya hay datos, no se duplican. Los sembradores se corren
  // varias veces sobre la misma base mientras se arma la demo.
  const yaHay = await prisma.cotizacion.count({ where: { empresaId } });
  if (yaHay > 0) {
    console.log("[comercial] Ya hay cotizaciones sembradas. No se repite.");
    return;
  }

  const porRol = async (rol: "VENTAS" | "ALMACEN" | "GERENCIA"): Promise<Actor> =>
    prisma.usuario.findFirstOrThrow({
      where: { empresaId, rol, activo: true },
      select: { id: true, nombre: true },
    });
  const [ventas, almacen, gerencia] = await Promise.all([
    porRol("VENTAS"),
    porRol("ALMACEN"),
    porRol("GERENCIA"),
  ]);

  const [clientes, vendedores, presentaciones, insumos, proveedores] = await Promise.all([
    prisma.cliente.findMany({
      where: { empresaId, estado: "ACTIVO" },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.vendedor.findMany({ where: { empresaId, activo: true }, select: { id: true } }),
    prisma.presentacion.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true, precio: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.insumo.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.proveedor.findMany({
      where: { empresaId, activo: true },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: "asc" },
    }),
  ]);

  if (clientes.length < 3 || vendedores.length === 0 || presentaciones.length === 0) {
    console.log("[comercial] Falta el maestro comercial (clientes, vendedores, presentaciones).");
    return;
  }
  if (insumos.length === 0 || proveedores.length === 0) {
    console.log("[compras] Falta el maestro de compras (insumos, proveedores).");
    return;
  }

  const precios = presentaciones.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precioLista: p.precio.toNumber(),
  }));

  const cotizaciones = await sembrarCotizaciones(
    empresaId,
    ventas,
    clientes,
    vendedores,
    precios
  );
  console.log(`[comercial] ${cotizaciones.length} cotizaciones sembradas.`);
  await sembrarHojasDeRuta(empresaId, ventas, clientes, vendedores);
  await sembrarRfq(empresaId, almacen, gerencia, insumos, proveedores);
  await sembrarAcuerdoSuministro(empresaId, almacen, insumos, proveedores);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
