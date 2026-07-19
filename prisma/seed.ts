import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const grasas = await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Grasas" } },
    update: {},
    create: { nombre: "Grasas", descripcion: "Grasas lubricantes industriales y automotrices" },
  });

  const aceites = await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Aceites" } },
    update: {},
    create: { nombre: "Aceites", descripcion: "Aceites lubricantes" },
  });

  const siliconas = await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Siliconas" } },
    update: {},
    create: { nombre: "Siliconas", descripcion: "Siliconas y productos afines" },
  });

  const proveedor = await prisma.proveedor.upsert({
    where: { empresaId_ruc: { empresaId: "1", ruc: "20123456789" } },
    update: {},
    create: {
      razonSocial: "Envases y Etiquetas del Perú S.A.C.",
      ruc: "20123456789",
      pais: "Peru",
      telefono: "01-2345678",
      email: "ventas@envasesperu.pe",
    },
  });

  const grasaChasis = await prisma.producto.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "GR-CHASIS" } },
    update: {},
    create: {
      codigo: "GR-CHASIS",
      nombre: "Grasa Chasis",
      descripcion: "Grasa multipropósito para chasis",
      categoriaId: grasas.id,
    },
  });

  const grasaLitio = await prisma.producto.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "GR-LITIO" } },
    update: {},
    create: {
      codigo: "GR-LITIO",
      nombre: "Grasa de Litio",
      descripcion: "Grasa a base de litio de alto desempeño",
      categoriaId: grasas.id,
    },
  });

  await prisma.presentacion.upsert({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-CHASIS-POTE-1LB" } },
    update: {},
    create: {
      sku: "GR-CHASIS-POTE-1LB",
      nombre: "Pote 1 lb",
      productoId: grasaChasis.id,
      contenidoKg: 0.454,
      precio: 12.5,
      stock: 100,
      stockMinimo: 20,
    },
  });

  await prisma.presentacion.upsert({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-CHASIS-BALDE-35LB" } },
    update: {},
    create: {
      sku: "GR-CHASIS-BALDE-35LB",
      nombre: "Balde 35 lb",
      productoId: grasaChasis.id,
      contenidoKg: 15.876,
      precio: 210.0,
      stock: 15,
      stockMinimo: 5,
    },
  });

  await prisma.presentacion.upsert({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-CHASIS-CIL-400LB" } },
    update: {},
    create: {
      sku: "GR-CHASIS-CIL-400LB",
      nombre: "Cilindro 400 lb",
      productoId: grasaChasis.id,
      contenidoKg: 181.44,
      precio: 2100.0,
      stock: 3,
      stockMinimo: 1,
    },
  });

  await prisma.presentacion.upsert({
    where: { empresaId_sku: { empresaId: "1", sku: "GR-LITIO-POTE-1LB" } },
    update: {},
    create: {
      sku: "GR-LITIO-POTE-1LB",
      nombre: "Pote 1 lb",
      productoId: grasaLitio.id,
      contenidoKg: 0.454,
      precio: 15.0,
      stock: 0,
      stockMinimo: 20,
    },
  });

  await prisma.insumo.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "MP-LITIO12" } },
    update: {},
    create: {
      codigo: "MP-LITIO12",
      nombre: "Jabón de litio 12-hidroxiestearato",
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
      stock: 500,
      stockMinimo: 100,
      costoUnitario: 18.3,
      proveedorId: proveedor.id,
    },
  });

  await prisma.insumo.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "ENV-POTE-1LB" } },
    update: {},
    create: {
      codigo: "ENV-POTE-1LB",
      nombre: "Pote plástico 1 lb con tapa",
      tipo: "ENVASE",
      unidadMedida: "unidad",
      stock: 2000,
      stockMinimo: 500,
      costoUnitario: 0.85,
      proveedorId: proveedor.id,
    },
  });

  await prisma.insumo.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "ETQ-CHASIS" } },
    update: {},
    create: {
      codigo: "ETQ-CHASIS",
      nombre: "Etiqueta Grasa Chasis",
      tipo: "ETIQUETA",
      unidadMedida: "unidad",
      stock: 3000,
      stockMinimo: 500,
      costoUnitario: 0.12,
      proveedorId: proveedor.id,
    },
  });

  console.log("Seed completo:", { grasas: grasas.id, aceites: aceites.id, siliconas: siliconas.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
