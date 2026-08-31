import { createHash } from "node:crypto";
import type { Tx } from "@/lib/inventario";
import { crearFechaCalendarioLocal } from "@/lib/fechas";

type Auditoria = { usuarioId: string; usuarioNombre: string };
export type LineaExtractoNormalizada = {
  fecha: Date;
  tipo: "INGRESO" | "EGRESO";
  descripcion: string;
  referencia: string | null;
  monto: number;
  huella: string;
};

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function separarCsv(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === separador && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }
  if (entreComillas) throw new Error("El extracto contiene comillas sin cerrar.");
  campos.push(actual.trim());
  return campos;
}

function fechaExtracto(valor: string): Date | null {
  const directa = crearFechaCalendarioLocal(valor.trim());
  if (directa) return directa;
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  return local ? crearFechaCalendarioLocal(`${local[3]}-${local[2]}-${local[1]}`) : null;
}

function numeroMonetario(valor: string): number {
  let limpio = valor.trim().replaceAll(" ", "").replace(/^(?:S\/|US\$|\$)/i, "");
  if (!limpio) return 0;
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    limpio = ultimaComa > ultimoPunto
      ? limpio.replaceAll(".", "").replace(",", ".")
      : limpio.replaceAll(",", "");
  } else if (ultimaComa >= 0) {
    limpio = limpio.replaceAll(".", "").replace(",", ".");
  } else if ((limpio.match(/\./g) ?? []).length > 1) {
    const partes = limpio.split(".");
    const decimales = partes.pop();
    limpio = partes.join("") + "." + decimales;
  }
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) throw new Error(`Importe inválido: ${valor}.`);
  return redondear(numero);
}

export function parsearExtractoBancario(contenido: string): LineaExtractoNormalizada[] {
  const lineas = contenido.replace(/^\uFEFF/, "").split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) throw new Error("El CSV debe incluir cabecera y al menos un movimiento.");
  const separador = lineas[0]?.includes(";") ? ";" : ",";
  const cabecera = separarCsv(lineas[0] ?? "", separador).map((campo) => campo.toLowerCase());
  const esperada = ["fecha", "descripcion", "referencia", "debito", "credito"];
  if (cabecera.length !== esperada.length || cabecera.some((campo, i) => campo !== esperada[i])) {
    throw new Error("La cabecera debe ser: fecha;descripcion;referencia;debito;credito.");
  }
  const ocurrencias = new Map<string, number>();
  return lineas.slice(1).map((linea, indice) => {
    const campos = separarCsv(linea, separador);
    if (campos.length !== 5) throw new Error(`La fila ${indice + 2} debe tener 5 columnas.`);
    const fecha = fechaExtracto(campos[0] ?? "");
    const descripcion = (campos[1] ?? "").trim();
    const referencia = (campos[2] ?? "").trim() || null;
    const debito = numeroMonetario(campos[3] ?? "");
    const credito = numeroMonetario(campos[4] ?? "");
    if (!fecha || !descripcion) throw new Error(`La fila ${indice + 2} tiene fecha o descripción inválida.`);
    if ((debito > 0) === (credito > 0)) {
      throw new Error(`La fila ${indice + 2} debe tener solo débito o solo crédito mayor a cero.`);
    }
    const base = [campos[0], descripcion, referencia ?? "", debito.toFixed(2), credito.toFixed(2)].join("|");
    const ocurrencia = (ocurrencias.get(base) ?? 0) + 1;
    ocurrencias.set(base, ocurrencia);
    return {
      fecha,
      tipo: credito > 0 ? "INGRESO" : "EGRESO",
      descripcion,
      referencia,
      monto: credito > 0 ? credito : debito,
      huella: createHash("sha256").update(base + "|" + ocurrencia).digest("hex"),
    };
  });
}

export function calcularResumenConciliacion(params: {
  saldoInicial: number;
  saldoFinal: number;
  movimientos: { tipo: "INGRESO" | "EGRESO"; monto: number; aplicado: number }[];
}) {
  const ingresos = redondear(params.movimientos.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0));
  const egresos = redondear(params.movimientos.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0));
  const saldoCalculado = redondear(params.saldoInicial + ingresos - egresos);
  const diferenciaExtracto = redondear(params.saldoFinal - saldoCalculado);
  const pendienteConciliar = redondear(params.movimientos.reduce((s, m) => s + Math.max(0, m.monto - m.aplicado), 0));
  return { ingresos, egresos, saldoCalculado, diferenciaExtracto, pendienteConciliar };
}

export async function aplicarMovimientoConciliacion(
  tx: Tx,
  params: { conciliacionId: string; movimientoExtractoId: string; movimientoCajaId: string; monto: number },
  audit: Auditoria
): Promise<void> {
  if (!Number.isFinite(params.monto) || params.monto <= 0) throw new Error("El monto a conciliar debe ser mayor a cero.");
  const [bloqueoExtracto, bloqueoCaja] = await Promise.all([
    tx.movimientoExtractoBancario.updateMany({ where: { id: params.movimientoExtractoId }, data: { monto: { increment: 0 } } }),
    tx.movimientoCaja.updateMany({ where: { id: params.movimientoCajaId }, data: { monto: { increment: 0 } } }),
  ]);
  if (bloqueoExtracto.count !== 1 || bloqueoCaja.count !== 1) throw new Error("El movimiento bancario o contable no existe.");
  const [conciliacion, extracto, caja] = await Promise.all([
    tx.conciliacionBancaria.findUnique({ where: { id: params.conciliacionId }, include: { cuentaBancaria: true } }),
    tx.movimientoExtractoBancario.findUnique({ where: { id: params.movimientoExtractoId }, include: { aplicaciones: true } }),
    tx.movimientoCaja.findUnique({ where: { id: params.movimientoCajaId }, include: { conciliaciones: true } }),
  ]);
  if (!conciliacion || !extracto || !caja || extracto.conciliacionId !== conciliacion.id) throw new Error("Los movimientos no pertenecen a la conciliación indicada.");
  if (conciliacion.estado !== "BORRADOR") throw new Error("Una conciliación cerrada no admite cambios.");
  if (conciliacion.empresaId !== caja.empresaId || (caja.cuentaBancariaId && caja.cuentaBancariaId !== conciliacion.cuentaBancariaId)) {
    throw new Error("El movimiento contable pertenece a otra empresa o cuenta bancaria.");
  }
  if (extracto.tipo !== caja.tipo) throw new Error("Ingreso y egreso deben coincidir en ambos libros.");
  if (caja.fecha < conciliacion.fechaDesde || caja.fecha >= new Date(conciliacion.fechaHasta.getTime() + 24 * 60 * 60 * 1000)) {
    throw new Error("El movimiento contable está fuera del período conciliado.");
  }
  const montoCaja = conciliacion.cuentaBancaria.moneda === "PEN"
    ? caja.monto.toNumber()
    : caja.moneda === conciliacion.cuentaBancaria.moneda && caja.montoOriginal
      ? caja.montoOriginal.toNumber()
      : null;
  if (montoCaja === null) throw new Error("La moneda del movimiento no coincide con la cuenta bancaria.");
  const aplicadoExtracto = extracto.aplicaciones.reduce((s, a) => s + a.monto.toNumber(), 0);
  const aplicadoCaja = caja.conciliaciones.reduce((s, a) => s + a.monto.toNumber(), 0);
  if (params.monto > extracto.monto.toNumber() - aplicadoExtracto + 1e-9 || params.monto > montoCaja - aplicadoCaja + 1e-9) {
    throw new Error("El monto supera el saldo pendiente de alguno de los movimientos.");
  }
  await tx.conciliacionBancariaAplicacion.create({
    data: { movimientoExtractoId: extracto.id, movimientoCajaId: caja.id, monto: params.monto, ...audit },
  });
  if (!caja.cuentaBancariaId) {
    await tx.movimientoCaja.update({ where: { id: caja.id }, data: { cuentaBancariaId: conciliacion.cuentaBancariaId } });
  }
}

export async function cerrarConciliacionBancaria(tx: Tx, id: string, audit: Auditoria): Promise<void> {
  const conciliacion = await tx.conciliacionBancaria.findUnique({
    where: { id }, include: { movimientos: { include: { aplicaciones: true } } },
  });
  if (!conciliacion || conciliacion.estado !== "BORRADOR") throw new Error("La conciliación no está abierta.");
  if (conciliacion.usuarioId === audit.usuarioId) throw new Error("La persona que preparó la conciliación no puede cerrarla.");
  if (conciliacion.movimientos.length === 0) throw new Error("Importe el extracto antes de cerrar.");
  const resumen = calcularResumenConciliacion({
    saldoInicial: conciliacion.saldoInicialExtracto.toNumber(),
    saldoFinal: conciliacion.saldoFinalExtracto.toNumber(),
    movimientos: conciliacion.movimientos.map((m) => ({
      tipo: m.tipo,
      monto: m.monto.toNumber(),
      aplicado: m.aplicaciones.reduce((s, a) => s + a.monto.toNumber(), 0),
    })),
  });
  if (Math.abs(resumen.diferenciaExtracto) > 0.009) throw new Error("El saldo final no cuadra con los movimientos del extracto.");
  if (resumen.pendienteConciliar > 0.009) throw new Error("Existen movimientos bancarios pendientes de conciliar.");
  const cerrado = await tx.conciliacionBancaria.updateMany({
    where: { id, estado: "BORRADOR" },
    data: { estado: "CERRADA", cerradaEn: new Date(), cerradaPorId: audit.usuarioId, cerradaPorNombre: audit.usuarioNombre },
  });
  if (cerrado.count !== 1) throw new Error("La conciliación cambió mientras se cerraba.");
}