import type { Tx } from "@/lib/inventario";

// Genera códigos correlativos tipo LG-00001 a partir del último registrado de
// LA MISMA COMPAÑÍA. Se llama dentro de una transacción para evitar duplicados.
//
// El `empresaId` es obligatorio en todos los generadores, sin valor por
// defecto. Antes trece de ellos leían el máximo global, sin filtrar, y eso
// rompía de dos maneras en cuanto existía una segunda compañía:
//
//   1. Si el código más alto pertenecía a otra compañía y no seguía el patrón
//      numérico (p. ej. "CLI-SUR-001" sembrado a mano), el parseo daba NaN, el
//      contador reiniciaba en 1 y chocaba contra un código que ya existía en
//      esta compañía: el alta fallaba con violación de índice único.
//   2. Aun cuando todo parseaba, la numeración de una compañía continuaba
//      desde el máximo de la otra. La compañía B empezaba en PED-00021 porque
//      A tenía veinte pedidos — con huecos en su propia serie, y filtrando
//      hacia afuera cuántos documentos lleva emitidos la otra.
//
// El índice único `(empresaId, codigo)` sigue siendo la última línea de
// defensa, y es la que hizo visible el defecto: fallaba en vez de duplicar.

function siguiente(prefijo: string, ultimo: string | null): string {
  const parseado = ultimo ? parseInt(ultimo.slice(prefijo.length + 1), 10) : NaN;
  // Un código que no siga el patrón numérico (ej. datos insertados directo en
  // la base) no debe romper el correlativo — se trata como si no hubiera
  // "último" registrado. Con el filtro por compañía esto solo puede pasar con
  // datos irregulares de la propia compañía, y el índice único lo detiene.
  const n = Number.isFinite(parseado) ? parseado + 1 : 1;
  return `${prefijo}-${String(n).padStart(5, "0")}`;
}

// Toma el cerrojo de numeración: un INSERT ... ON CONFLICT DO UPDATE sobre una
// fila fija, portable a PostgreSQL. La escritura obliga a que dos
// transacciones concurrentes se serialicen aquí, antes de leer el último
// número — sin esto, ambas leerían el mismo máximo y generarían el mismo
// código, y el choque recién lo descubriría el índice único.
//
// El cerrojo es global a propósito, aunque la numeración sea por compañía:
// serializa más de lo estrictamente necesario, pero una fila fija es lo que
// hace el mecanismo simple y portable. Con el volumen de esta operación, la
// contención no es un problema.
//
// La fila vive en su propia tabla y no en ConfiguracionEmpresa: un mecanismo
// de concurrencia no debe depender de un maestro de negocio (cuando esa
// configuración pasó a ser una fila por compañía, el cerrojo dejó de funcionar).
export async function reservarCorrelativo(tx: Tx): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO cerrojo_correlativo (id, actualizadoEn)
    VALUES ('1', CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET actualizadoEn = CURRENT_TIMESTAMP
  `;
}

export async function siguienteCodigoLote(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.loteGranel.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("LG", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEnvasado(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.envasado.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("ENV", ultimo?.codigo ?? null);
}

export async function siguienteNumeroPedido(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.pedido.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("PED", ultimo?.numero ?? null);
}

export async function siguienteNumeroOrdenCompra(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.ordenCompra.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("OC", ultimo?.numero ?? null);
}

export async function siguienteNumeroRfq(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.rfqCompra.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("RFQ", ultimo?.numero ?? null);
}

export async function siguienteNumeroAcuerdoSuministro(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.acuerdoSuministro.findFirst({ where: { empresaId }, orderBy: { numero: "desc" } });
  return siguiente("AS", ultimo?.numero ?? null);
}

export async function siguienteNumeroRecepcion(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.recepcionCompra.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("RC", ultimo?.numero ?? null);
}

export async function siguienteNumeroHojaRuta(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.hojaRuta.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("HR", ultimo?.numero ?? null);
}

export async function siguienteCodigoCliente(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.cliente.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("CLI", ultimo?.codigo ?? null);
}

export async function siguienteNumeroOleadaPicking(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.oleadaPicking.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("OP", ultimo?.numero ?? null);
}

export async function siguienteNumeroLicitacionFlete(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.licitacionFlete.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("LF", ultimo?.numero ?? null);
}

export async function siguienteCodigoTransportista(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.transportista.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("TRA", ultimo?.codigo ?? null);
}

// El traslado no tiene tabla propia (son dos MovimientoKardex con la misma
// referencia): el correlativo sale de la última referencia "TR-" del kardex.
export async function siguienteCodigoTraslado(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.movimientoKardex.findFirst({
    where: { empresaId, origen: "TRASLADO", referencia: { startsWith: "TR-" } },
    orderBy: { referencia: "desc" },
    select: { referencia: true },
  });
  return siguiente("TR", ultimo?.referencia ?? null);
}

export async function siguienteCodigoConteo(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.conteoInventario.findFirst({ where: { empresaId }, orderBy: { codigo: "desc" } });
  return siguiente("CI", ultimo?.codigo ?? null);
}

export async function siguienteNumeroCotizacion(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.cotizacion.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("COT", ultimo?.numero ?? null);
}

export async function siguienteCodigoActivoFijo(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.activoFijo.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("AF", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEquipo(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.equipo.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("EQ", ultimo?.codigo ?? null);
}

// OrdenMantenimiento no lleva empresaId propio: cuelga del equipo, que sí lo
// tiene. Se filtra por la relación, igual que hace el panel general.
export async function siguienteCodigoOrdenMantenimiento(
  tx: Tx,
  empresaId: string
): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.ordenMantenimiento.findFirst({
    where: { equipo: { empresaId } },
    orderBy: { codigo: "desc" },
  });
  return siguiente("OM", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEmpleado(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.empleado.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("EMP", ultimo?.codigo ?? null);
}

export async function siguienteNumeroReclamo(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.reclamoCliente.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("RCL", ultimo?.numero ?? null);
}

export async function siguienteCodigoOrdenInterna(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.ordenInterna.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("OI", ultimo?.codigo ?? null);
}

export async function siguienteCodigoProyecto(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.proyecto.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
  });
  return siguiente("PRY", ultimo?.codigo ?? null);
}

export async function siguienteNumeroNotaDebito(tx: Tx, empresaId: string): Promise<string> {
  await reservarCorrelativo(tx);
  const ultimo = await tx.notaDebito.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  });
  return siguiente("ND", ultimo?.numero ?? null);
}
