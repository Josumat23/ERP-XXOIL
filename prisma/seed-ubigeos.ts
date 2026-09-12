import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import ubigeos from "./data/ubigeos.json";

// Catálogo oficial de códigos UBIGEO de SUNAT (1,835 distritos), sembrado
// una sola vez. Fuente: CONCYTEC (Consejo Nacional de Ciencia, Tecnología e
// Innovación Tecnológica), tabla de concordancia INEI/RENIEC/SUNAT derivada
// del Excel que SUNAT publica en su propio sitio — se usa específicamente
// la columna SUNAT porque diverge de INEI/RENIEC en 53 distritos (ej.
// Huánuco: depto "10" en SUNAT/INEI vs "09" en RENIEC).

type ClienteSiembra = {
  ubigeo: {
    count: () => Promise<number>;
    createMany: (args: {
      data: { codigo: string; departamento: string; provincia: string; distrito: string }[];
    }) => Promise<unknown>;
  };
};

/**
 * Idempotente: si ya hay ubigeos cargados, no hace nada.
 *
 * Se exporta para que el seed principal lo llame: el catálogo dejó de ser
 * opcional el día que Cliente, Proveedor y Almacén eligen su distrito de él
 * —sin catálogo, esos selectores salen vacíos en una instalación nueva—.
 */
export async function sembrarUbigeos(prisma: ClienteSiembra): Promise<number> {
  const existentes = await prisma.ubigeo.count();
  if (existentes > 0) return 0;

  const filas = ubigeos as {
    codigo: string;
    departamento: string;
    provincia: string;
    distrito: string;
  }[];
  await prisma.ubigeo.createMany({ data: filas });
  return filas.length;
}

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const sembrados = await sembrarUbigeos(prisma);
    console.log(
      sembrados > 0
        ? `Sembrados ${sembrados} ubigeos SUNAT.`
        : "Ya hay ubigeos cargados — no se vuelve a sembrar."
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al invocarse como script (`npm run seed:ubigeos`), no al
// importarse desde el seed principal.
if (process.argv[1]?.includes("seed-ubigeos")) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
