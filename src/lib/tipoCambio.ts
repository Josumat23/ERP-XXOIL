import { prisma } from "@/lib/prisma";
import { obtenerTipoCambioBcrp } from "@/lib/bcrp";

function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Tipo de cambio del día (S//US$), cacheado en TipoCambio para no golpear el
 * API del BCRP en cada carga de pantalla. Best-effort: si el BCRP no
 * responde y no hay caché de hoy, cae al último valor guardado; si nunca
 * hubo ninguno, devuelve null (el formulario de la orden de compra pide
 * ingresarlo a mano en ese caso — nunca bloquea la operación).
 */
export async function obtenerTipoCambioVigente(): Promise<number | null> {
  const hoy = inicioDelDia(new Date());
  const existente = await prisma.tipoCambio.findUnique({ where: { fecha: hoy } });
  if (existente) return existente.valor.toNumber();

  const valor = await obtenerTipoCambioBcrp();
  if (valor === null) {
    const ultimo = await prisma.tipoCambio.findFirst({ orderBy: { fecha: "desc" } });
    return ultimo ? ultimo.valor.toNumber() : null;
  }

  await prisma.tipoCambio.upsert({
    where: { fecha: hoy },
    update: { valor, fuente: "BCRP" },
    create: { fecha: hoy, valor, fuente: "BCRP" },
  });
  return valor;
}

export function convertirAPen(monto: number, moneda: string, tipoCambio: number): number {
  return moneda === "PEN" ? monto : monto * tipoCambio;
}
