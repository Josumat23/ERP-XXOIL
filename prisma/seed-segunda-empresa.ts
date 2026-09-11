// Siembra una SEGUNDA compañía con datos propios, para poder ejercer el
// criterio de aceptación del ítem 0.2 en su forma fuerte: dos compañías
// **ambas con datos**.
//
// Con una compañía vacía solo se detecta "la consulta no filtra". Con dos
// pobladas se detecta además "la consulta filtra por la compañía equivocada",
// que es el error más silencioso de los dos.
//
// Los importes son deliberadamente distintos y reconocibles (1.234,56) para
// que una cifra cruzada salte a la vista en pantalla.
//
// Idempotente: si la compañía ya existe, no hace nada.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

const EMPRESA_ID = "empresa-demo-2";
const ACTOR = { usuarioId: "sistema", usuarioNombre: "Sembrado de demostración" };

async function main() {
  const existente = await prisma.empresa.findUnique({ where: { id: EMPRESA_ID } });
  if (existente) {
    console.log(`La compañía ${EMPRESA_ID} ya existe: no se siembra de nuevo.`);
    return;
  }

  await prisma.empresa.create({
    data: {
      id: EMPRESA_ID,
      razonSocial: "Lubricantes del Sur S.A.C.",
      ruc: "20555444333",
      pais: "Peru",
      monedaFuncional: "PEN",
    },
  });

  // Configuración propia, con RUC y tasa de IGV distintos a los de la primera
  // compañía: si una pantalla lee la configuración equivocada, el RUC del
  // membrete o el IGV de un documento lo delatan a simple vista.
  await prisma.configuracionEmpresa.create({
    data: {
      empresaId: EMPRESA_ID,
      razonSocial: "Lubricantes del Sur S.A.C.",
      ruc: "20555444333",
      ciudad: "Arequipa, Perú",
      tasaIgv: 10,
      tarifaHoraManoObra: 33,
      montoAprobacionCompras: 1111,
      montoAprobacionPagos: 2222,
    },
  });

  const [almacen, categoria, vendedor, zona] = await Promise.all([
    prisma.almacen.create({
      data: { empresaId: EMPRESA_ID, tipo: "PLANTA", codigo: "SUR", nombre: "Planta Arequipa" },
    }),
    prisma.categoria.create({ data: { empresaId: EMPRESA_ID, nombre: "Lubricantes del Sur" } }),
    prisma.vendedor.create({
      data: { empresaId: EMPRESA_ID, nombre: "Vendedor del Sur", tipo: "SOLO_COMISION", tasaComision: 3 },
    }),
    prisma.zona.create({ data: { empresaId: EMPRESA_ID, nombre: "Sur" } }),
  ]);

  const producto = await prisma.producto.create({
    data: {
      empresaId: EMPRESA_ID,
      categoriaId: categoria.id,
      codigo: "SUR-001",
      nombre: "Aceite multigrado del Sur",
    },
  });

  const presentacion = await prisma.presentacion.create({
    data: {
      empresaId: EMPRESA_ID,
      productoId: producto.id,
      sku: "SUR-001-4L",
      nombre: "Balde 4 L",
      contenidoKg: 3.6,
      precio: 123.456,
      stock: 100,
      costoPromedio: 80,
    },
  });

  const cliente = await prisma.cliente.create({
    data: {
      empresaId: EMPRESA_ID,
      codigo: "CLI-SUR-001",
      razonSocial: "Minera del Sur S.A.",
      zonaId: zona.id,
      vendedorId: vendedor.id,
    },
  });

  // Un pedido facturado, con importes reconocibles a simple vista.
  const cantidad = 10;
  const precioUnitario = 123.456;
  const subtotal = Number((cantidad * precioUnitario).toFixed(2)); // 1234.56
  const tasaIgv = 18;
  const igv = Number(((subtotal * tasaIgv) / 100).toFixed(2));
  const total = Number((subtotal + igv).toFixed(2));

  const pedido = await prisma.pedido.create({
    data: {
      empresaId: EMPRESA_ID,
      numero: "PED-SUR-0001",
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      almacenId: almacen.id,
      condicionPago: "DIAS_30",
      estado: "FACTURADO",
      subtotalBruto: subtotal,
      total: subtotal,
      tasaIgv,
      igv,
      totalConIgv: total,
      ...ACTOR,
      detalles: {
        create: [
          {
            presentacionId: presentacion.id,
            cantidad,
            precioLista: precioUnitario,
            precioUnitario,
            subtotal,
          },
        ],
      },
    },
    include: { detalles: true },
  });

  const hoy = new Date();
  const factura = await prisma.factura.create({
    data: {
      empresaId: EMPRESA_ID,
      numero: "F999-00000001",
      pedidoId: pedido.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      condicionPago: "DIAS_30",
      fechaEmision: hoy,
      fechaVencimiento: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30),
      subtotal,
      tasaIgv,
      igv,
      total,
      saldo: total,
      subtotalFuncional: subtotal,
      igvFuncional: igv,
      totalFuncional: total,
      saldoFuncional: total,
      estado: "PENDIENTE",
      ...ACTOR,
      detalles: {
        create: [
          {
            pedidoDetalleId: pedido.detalles[0].id,
            presentacionId: presentacion.id,
            cantidad,
            precioUnitario,
            subtotal,
          },
        ],
      },
    },
  });

  console.log(`Segunda compañía sembrada: ${EMPRESA_ID}`);
  console.log(`  Cliente: ${cliente.razonSocial}`);
  console.log(`  Factura ${factura.numero}: base S/ ${subtotal} · total S/ ${total}`);
  console.log(`  Inventario: ${presentacion.nombre}, 100 u a costo S/ 80 = S/ 8,000`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
