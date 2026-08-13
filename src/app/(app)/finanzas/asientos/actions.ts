"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import type { Tx } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

type LineaManual = { cuentaId: string; glosa: string; debe: number; haber: number };

async function siguienteNumeroAsiento(tx: Tx): Promise<string> {
  const ultimo = await tx.asientoContable.findFirst({ orderBy: { numero: "desc" } });
  const n = ultimo ? parseInt(ultimo.numero.slice(3), 10) + 1 : 1;
  return `AS-${String(n).padStart(5, "0")}`;
}

export async function crearAsientoManual(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const glosa = String(formData.get("glosa") ?? "").trim();
  const fechaStr = String(formData.get("fecha") ?? "");

  let lineas: LineaManual[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del asiento es inválido." };
  }

  if (!glosa) return { error: "La glosa es obligatoria." };
  if (!fechaStr) return { error: "Indique la fecha del asiento." };

  const r2 = (n: number) => Math.round(n * 100) / 100;
  lineas = lineas
    .map((l) => ({ ...l, debe: r2(l.debe || 0), haber: r2(l.haber || 0) }))
    .filter((l) => l.cuentaId && (l.debe > 0 || l.haber > 0));

  if (lineas.length < 2) return { error: "El asiento necesita al menos dos líneas con importe." };
  if (lineas.some((l) => l.debe > 0 && l.haber > 0)) {
    return { error: "Cada línea debe tener importe solo en el debe o solo en el haber." };
  }

  const totalDebe = r2(lineas.reduce((acc, l) => acc + l.debe, 0));
  const totalHaber = r2(lineas.reduce((acc, l) => acc + l.haber, 0));
  if (totalDebe !== totalHaber) {
    return {
      error: `El asiento está descuadrado: debe S/ ${totalDebe.toFixed(2)} vs haber S/ ${totalHaber.toFixed(2)}.`,
    };
  }

  const fecha = new Date(`${fechaStr}T00:00:00`);
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;

  const periodo = await prisma.periodoFiscal.findUnique({
    where: { empresaId_anio_mes: { empresaId: "1", anio, mes } },
  });
  if (periodo?.estado === "CERRADO") {
    return { error: `El período fiscal ${mes}/${anio} está cerrado. Reábralo en Configuración → Calendario fiscal.` };
  }

  let asientoId = "";
  await prisma.$transaction(async (tx) => {
    const libro =
      (await tx.libro.findFirst({ where: { codigo: "DIARIO" } })) ??
      (await tx.libro.create({ data: { codigo: "DIARIO", nombre: "Libro diario" } }));
    const numero = await siguienteNumeroAsiento(tx);

    const asiento = await tx.asientoContable.create({
      data: {
        libroId: libro.id,
        numero,
        fecha,
        anio,
        mes,
        origen: "MANUAL",
        glosa,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: {
          create: lineas.map((l) => ({
            cuentaId: l.cuentaId,
            glosa: l.glosa.trim() || null,
            debe: l.debe,
            haber: l.haber,
          })),
        },
      },
    });
    asientoId = asiento.id;
  });

  revalidatePath("/finanzas/asientos");
  redirect(`/finanzas/asientos/${asientoId}`);
}

// Los asientos nunca se editan ni borran: la corrección es un asiento de
// reverso (debe y haber intercambiados), enlazado en ambos sentidos.
export async function reversarAsiento(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del reverso es obligatorio." };

  let reversoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const original = await tx.asientoContable.findUnique({
        where: { id },
        include: { detalles: true },
      });
      if (!original) throw new Error("El asiento no existe.");
      if (original.reversadoPor) {
        throw new Error(`El asiento ya fue reversado por ${original.reversadoPor}.`);
      }
      if (original.origen === "REVERSO") {
        throw new Error("Un asiento de reverso no puede volver a reversarse.");
      }

      const hoy = new Date();
      const anio = hoy.getFullYear();
      const mes = hoy.getMonth() + 1;
      const periodo = await tx.periodoFiscal.findUnique({
        where: { empresaId_anio_mes: { empresaId: "1", anio, mes } },
      });
      if (periodo?.estado === "CERRADO") {
        throw new Error(`El período fiscal ${mes}/${anio} está cerrado.`);
      }

      const numero = await siguienteNumeroAsiento(tx);
      const reclamo = await tx.asientoContable.updateMany({
        where: { id, reversadoPor: null, origen: { not: "REVERSO" } },
        data: { reversadoPor: numero },
      });
      if (reclamo.count !== 1) {
        throw new Error("El asiento cambi\u00f3 mientras se reversaba. Actualice la p\u00e1gina e intente nuevamente.");
      }

      const reverso = await tx.asientoContable.create({
        data: {
          libroId: original.libroId,
          numero,
          fecha: hoy,
          anio,
          mes,
          origen: "REVERSO",
          glosa: `Reverso de ${original.numero}: ${motivo}`,
          referencia: original.referencia,
          reversaA: original.numero,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: original.detalles.map((d) => ({
              cuentaId: d.cuentaId,
              glosa: d.glosa,
              debe: d.haber, // intercambiados
              haber: d.debe,
            })),
          },
        },
      });
      reversoId = reverso.id;
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/finanzas/asientos");
  redirect(`/finanzas/asientos/${reversoId}`);
}
