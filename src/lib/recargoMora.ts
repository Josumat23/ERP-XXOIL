import type { Tx } from "@/lib/inventario";
import { convertirAMonedaFuncional } from "@/lib/multimoneda";
import { postearRecargoMora } from "@/lib/contabilidad";

export type ActorTarea = { usuarioId: string; usuarioNombre: string };

export type ResultadoRecargoMora =
  | { ok: true; monto: number; montoFuncional: number; tipoCambio: number }
  | { ok: false; error: string };

// Extraído de comercial/facturas/actions.ts para reusarlo tanto desde el
// botón manual (aplicarRecargoMora, una factura a la vez) como desde la
// tarea programada que recorre todas las facturas vencidas. Solo cubre los
// días transcurridos desde el último recargo aplicado (o desde el
// vencimiento, si es el primero) — nunca duplica el cobro de los mismos días.
export async function aplicarRecargoAFactura(
  tx: Tx,
  facturaId: string,
  actor: ActorTarea
): Promise<ResultadoRecargoMora> {
  const bloqueo = await tx.factura.updateMany({
    where: { id: facturaId },
    data: { saldo: { increment: 0 }, saldoFuncional: { increment: 0 } },
  });
  if (bloqueo.count !== 1) return { ok: false, error: "La factura no existe." };

  const factura = await tx.factura.findUnique({
    where: { id: facturaId },
    include: { recargosMora: { orderBy: { fecha: "desc" }, take: 1 } },
  });
  if (!factura) return { ok: false, error: "La factura no existe." };
  if (factura.estado !== "PENDIENTE") return { ok: false, error: "Solo aplica a facturas pendientes." };

  const hoy = new Date();
  if (factura.fechaVencimiento >= hoy) return { ok: false, error: "La factura todavía no está vencida." };

  const config = await tx.configuracionEmpresa.findUniqueOrThrow({ where: { id: "1" } });
  const tasa = config.tasaRecargoMora.toNumber();
  if (tasa <= 0) {
    return { ok: false, error: "La tasa de recargo por mora no está configurada (Configuración → Empresa)." };
  }

  const desde = factura.recargosMora[0]?.fecha ?? factura.fechaVencimiento;
  const diasCalculados = Math.floor((hoy.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
  if (diasCalculados <= 0) return { ok: false, error: "Ya se cobró el recargo hasta el día de hoy." };

  const monto = Math.round(
    factura.saldo.toNumber() * (tasa / 100) * (diasCalculados / 30) * 100
  ) / 100;
  const tipoCambio = factura.moneda === "PEN"
    ? 1
    : (await tx.tipoCambio.findFirst({
        where: { fecha: { lte: hoy } },
        orderBy: { fecha: "desc" },
      }))?.valor.toNumber();
  if (!tipoCambio) {
    return { ok: false, error: "No existe un tipo de cambio BCRP cacheado para valorar el recargo USD." };
  }
  const montoFuncional = convertirAMonedaFuncional(
    monto,
    factura.moneda,
    tipoCambio,
    factura.monedaFuncional
  );

  await tx.recargoMora.create({
    data: {
      facturaId,
      diasCalculados,
      tasaAplicada: tasa,
      monto,
      moneda: factura.moneda,
      tipoCambio,
      montoFuncional,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
    },
  });
  const actualizada = await tx.factura.updateMany({
    where: {
      id: facturaId,
      estado: factura.estado,
      saldo: factura.saldo,
      saldoFuncional: factura.saldoFuncional,
    },
    data: {
      saldo: { increment: monto },
      saldoFuncional: { increment: montoFuncional },
    },
  });
  if (actualizada.count !== 1) {
    throw new Error("La factura cambió durante el cálculo del recargo. Intente nuevamente.");
  }

  await postearRecargoMora(
    tx,
    { numeroFactura: factura.numero, montoFuncional },
    actor
  );

  return { ok: true, monto, montoFuncional, tipoCambio };
}
