"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { esAnioOperativoValido } from "@/lib/periodos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export async function generarAnioFiscal(anio: number) {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;
  if (!esAnioOperativoValido(anio)) return;
  const empresaId = await obtenerEmpresaActivaId();

  await prisma.$transaction(
    Array.from({ length: 12 }, (_, indice) => {
      const mes = indice + 1;
      return prisma.periodoFiscal.upsert({
        where: { empresaId_anio_mes: { empresaId, anio, mes } },
        update: {},
        create: { empresaId, anio, mes },
      });
    })
  );

  revalidatePath("/configuracion/calendario-fiscal");
}

export async function alternarPeriodoFiscal(id: string) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();

  const periodo = await prisma.periodoFiscal.findFirst({ where: { id, empresaId } });
  if (!periodo) return;

  const cerrando = periodo.estado === "ABIERTO";
  await prisma.$transaction(async (tx) => {
    const cambiados = await tx.periodoFiscal.updateMany({
      where: { id, empresaId, estado: periodo.estado },
      data: {
        estado: cerrando ? "CERRADO" : "ABIERTO",
        cerradoEn: cerrando ? new Date() : null,
        cerradoPor: cerrando ? auth.usuario.nombre : null,
      },
    });
    // Otra sesión pudo cambiar el estado entremedio: sin cambio no hay nada
    // que auditar.
    if (cambiados.count !== 1) return;
    const despues = await tx.periodoFiscal.findUniqueOrThrow({ where: { id } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "PeriodoFiscal", registroId: id, accion: "ACTUALIZAR", antes: periodo, despues, usuario: auth.usuario });
  });

  revalidatePath("/configuracion/calendario-fiscal");
}
