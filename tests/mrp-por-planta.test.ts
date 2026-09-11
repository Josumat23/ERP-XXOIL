import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { calcularOperaciones, type DetalleCalculado } from "@/lib/proyecciones";

// Escenario mínimo pero completo: una compañía con DOS plantas, el mismo
// producto con stock repartido de forma desigual entre ellas, y un pedido
// firme en una sola. Es lo que distingue "planifica por planta" de "planifica
// por compañía y le pone una etiqueta".
async function escenario(sufijo: string) {
  const empresaId = `empresa-mrp-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  const [norte, sur] = await Promise.all([
    prisma.almacen.create({
      data: { empresaId, tipo: "PLANTA", codigo: "NORTE", nombre: "Planta Norte" },
    }),
    prisma.almacen.create({
      data: { empresaId, tipo: "PLANTA", codigo: "SUR", nombre: "Planta Sur" },
    }),
  ]);

  const categoria = await prisma.categoria.create({ data: { empresaId, nombre: `Cat ${sufijo}` } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `P-${sufijo}`, nombre: "Grasa" },
  });
  const presentacion = await prisma.presentacion.create({
    data: {
      empresaId,
      productoId: producto.id,
      sku: `SKU-${sufijo}`,
      nombre: "Balde 10 kg",
      contenidoKg: 10,
      precio: 100,
      // Stock agregado de la compañía: 100. Repartido 90 en Norte y 10 en Sur.
      stock: 100,
    },
  });
  await prisma.saldoAlmacen.createMany({
    data: [
      { almacenId: norte.id, tipoItem: "PRESENTACION", presentacionId: presentacion.id, cantidad: 90 },
      { almacenId: sur.id, tipoItem: "PRESENTACION", presentacionId: presentacion.id, cantidad: 10 },
    ],
  });

  const insumo = await prisma.insumo.create({
    data: {
      empresaId,
      codigo: `INS-${sufijo}`,
      nombre: "Aceite base",
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
      costoUnitario: 5,
      stock: 1000,
    },
  });
  await prisma.formula.create({
    data: {
      empresaId,
      productoId: producto.id,
      version: 1,
      rendimientoKg: 100,
      usuarioId: "prueba",
      usuarioNombre: "Prueba",
      detalles: { create: [{ insumoId: insumo.id, cantidad: 100 }] },
    },
  });

  // Un pedido firme de 50 unidades, solo en la Planta Sur.
  const [vendedor, cliente] = await Promise.all([
    prisma.vendedor.create({
      data: { empresaId, nombre: "V", tipo: "SOLO_COMISION", tasaComision: 1 },
    }),
    prisma.cliente.create({ data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente" } }),
  ]);
  await prisma.pedido.create({
    data: {
      empresaId,
      numero: `PED-${sufijo}`,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      almacenId: sur.id,
      estado: "PENDIENTE",
      total: 5000,
      usuarioId: "prueba",
      usuarioNombre: "Prueba",
      detalles: {
        create: [
          { presentacionId: presentacion.id, cantidad: 50, precioUnitario: 100, subtotal: 5000 },
        ],
      },
    },
  });

  const detalles: DetalleCalculado[] = [
    {
      presentacionId: presentacion.id,
      nombre: "Grasa — Balde 10 kg",
      productoId: producto.id,
      contenidoKg: 10,
      precio: 100,
      costoPromedio: 50,
      stock: 100,
      stockReservado: 0,
      stockMinimo: 0,
      ventasBase: 0,
      indiceEstacionalidad: 1,
      sinHistorico: true,
      ajusteCualitativoPct: 0,
      demandaProyectada: 0,
      ventasProyectadas: 0,
    },
  ];

  return { empresaId, norte, sur, presentacion, insumo, detalles };
}

async function limpiar(empresaId: string) {
  await prisma.pedidoDetalle.deleteMany({ where: { pedido: { empresaId } } });
  await prisma.pedido.deleteMany({ where: { empresaId } });
  await prisma.cliente.deleteMany({ where: { empresaId } });
  await prisma.vendedor.deleteMany({ where: { empresaId } });
  await prisma.formulaDetalle.deleteMany({ where: { formula: { empresaId } } });
  await prisma.formula.deleteMany({ where: { empresaId } });
  await prisma.saldoAlmacen.deleteMany({ where: { almacen: { empresaId } } });
  await prisma.insumo.deleteMany({ where: { empresaId } });
  await prisma.presentacion.deleteMany({ where: { empresaId } });
  await prisma.producto.deleteMany({ where: { empresaId } });
  await prisma.categoria.deleteMany({ where: { empresaId } });
  await prisma.almacen.deleteMany({ where: { empresaId } });
  await prisma.empresa.deleteMany({ where: { id: empresaId } });
}

test("el MRP por planta netea contra el stock de esa planta, no el de la compañía", async () => {
  const sufijo = Date.now().toString(36);
  const { empresaId, norte, sur, detalles } = await escenario(sufijo);
  const hoy = new Date();

  try {
    // Compañía completa: el pedido de 50 se cubre con las 100 unidades
    // agregadas, así que no hay nada que producir ni comprar.
    const compania = await calcularOperaciones(
      detalles,
      hoy.getFullYear(),
      Math.floor(hoy.getMonth() / 3) + 1,
      empresaId
    );
    assert.equal(compania.kgGranelTotal, 0, "con 100 en stock agregado no hay que producir");

    // Planta Sur: el mismo pedido de 50, pero allí solo hay 10 unidades.
    // Faltan 40 → 400 kg de granel → 400 kg de insumo.
    const planta = await calcularOperaciones(
      detalles,
      hoy.getFullYear(),
      Math.floor(hoy.getMonth() / 3) + 1,
      empresaId,
      sur.id
    );
    assert.equal(planta.kgGranelTotal, 400, "en Sur faltan 40 unidades de 10 kg");
    assert.equal(planta.insumos.length, 1);
    assert.equal(planta.insumos[0].consumoProyectado, 400);

    // Planta Norte: no tiene pedidos firmes, así que no necesita nada — aunque
    // sea la que más stock tiene.
    const otra = await calcularOperaciones(
      detalles,
      hoy.getFullYear(),
      Math.floor(hoy.getMonth() / 3) + 1,
      empresaId,
      norte.id
    );
    assert.equal(otra.kgGranelTotal, 0, "Norte no tiene demanda firme");
    assert.deepEqual(otra.demandaNeteada.map((d) => d.pedidosFirmes), [0]);
  } finally {
    await limpiar(empresaId);
  }
});

test("planificar por planta deja el pronóstico fuera, y lo declara", async () => {
  const sufijo = `${Date.now().toString(36)}p`;
  const { empresaId, sur, detalles } = await escenario(sufijo);
  const hoy = new Date();

  try {
    // Un pronóstico alto que, a nivel compañía, manda a producir.
    const conPronostico = detalles.map((d) => ({ ...d, demandaProyectada: 500 }));

    const compania = await calcularOperaciones(
      conPronostico,
      hoy.getFullYear(),
      Math.floor(hoy.getMonth() / 3) + 1,
      empresaId
    );
    assert.equal(compania.demandaNeteada[0].pronostico, 500);
    assert.ok(compania.kgGranelTotal > 0, "el pronóstico debe planificar producción");

    // Por planta, el pronóstico no se reparte: se excluye. Repartirlo exigiría
    // un criterio de asignación que es decisión del negocio.
    const planta = await calcularOperaciones(
      conPronostico,
      hoy.getFullYear(),
      Math.floor(hoy.getMonth() / 3) + 1,
      empresaId,
      sur.id
    );
    assert.equal(planta.demandaNeteada[0].pronostico, 0);
    assert.equal(planta.demandaNeteada[0].pedidosFirmes, 50);
    assert.equal(planta.demandaNeteada[0].demandaPlanificada, 50);
  } finally {
    await limpiar(empresaId);
  }
});

test("la pantalla del MRP declara la limitación del pronóstico por planta", async () => {
  // Si el aviso desaparece, el usuario cree que planificó con pronóstico.
  const pagina = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/mrp/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /El pronóstico queda fuera/);
  assert.match(pagina, /tipo: "PLANTA"/);
  // La orden de compra generada hereda la planta elegida como destino.
  assert.doesNotMatch(pagina, /almacenId: null/);
});
