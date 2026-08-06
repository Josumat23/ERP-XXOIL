import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import ubigeos from "./data/ubigeos.json";

// Catálogo oficial de códigos UBIGEO de SUNAT (1,835 distritos), sembrado
// una sola vez. Fuente: CONCYTEC (Consejo Nacional de Ciencia, Tecnología e
// Innovación Tecnológica), tabla de concordancia INEI/RENIEC/SUNAT derivada
// del Excel que SUNAT publica en su propio sitio — se usa específicamente
// la columna SUNAT porque diverge de INEI/RENIEC en 53 distritos (ej.
// Huánuco: depto "10" en SUNAT/INEI vs "09" en RENIEC).
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const existentes = await prisma.ubigeo.count();
  if (existentes > 0) {
    console.log(`Ya hay ${existentes} ubigeos cargados — no se vuelve a sembrar.`);
    return;
  }

  const filas = ubigeos as { codigo: string; departamento: string; provincia: string; distrito: string }[];
  await prisma.ubigeo.createMany({ data: filas });
  console.log(`Sembrados ${filas.length} ubigeos SUNAT.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
