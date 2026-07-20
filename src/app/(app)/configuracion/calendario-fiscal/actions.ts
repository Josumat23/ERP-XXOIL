"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";

export async function generarAnioFiscal(anio: number) {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;

  for (let mes = 1; mes <= 12; mes++) {
    await prisma.periodoFiscal.upsert({
      where: { empresaId_anio_mes: { empresaId: "1", anio, mes } },
      update: {},
      create: { anio, mes },
    });
  }

  revalidatePath("/configuracion/calendario-fiscal");
}

export async function alternarPeriodoFiscal(id: string) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;

  const periodo = await prisma.periodoFiscal.findUnique({ where: { id } });
  if (!periodo) return;

  const cerrando = periodo.estado === "ABIERTO";
  await prisma.periodoFiscal.update({
    where: { id },
    data: {
      estado: cerrando ? "CERRADO" : "ABIERTO",
      cerradoEn: cerrando ? new Date() : null,
      cerradoPor: cerrando ? auth.usuario.nombre : null,
    },
  });

  revalidatePath("/configuracion/calendario-fiscal");
}
