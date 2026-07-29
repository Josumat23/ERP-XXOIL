import type { Tx } from "@/lib/inventario";

// Genera códigos correlativos tipo LG-00001 a partir del último registrado.
// Se llama dentro de una transacción para evitar duplicados.

function siguiente(prefijo: string, ultimo: string | null): string {
  const n = ultimo ? parseInt(ultimo.slice(prefijo.length + 1), 10) + 1 : 1;
  return `${prefijo}-${String(n).padStart(5, "0")}`;
}

export async function siguienteCodigoLote(tx: Tx): Promise<string> {
  const ultimo = await tx.loteGranel.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("LG", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEnvasado(tx: Tx): Promise<string> {
  const ultimo = await tx.envasado.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("ENV", ultimo?.codigo ?? null);
}

export async function siguienteNumeroPedido(tx: Tx): Promise<string> {
  const ultimo = await tx.pedido.findFirst({ orderBy: { numero: "desc" } });
  return siguiente("PED", ultimo?.numero ?? null);
}

export async function siguienteNumeroOrdenCompra(tx: Tx): Promise<string> {
  const ultimo = await tx.ordenCompra.findFirst({ orderBy: { numero: "desc" } });
  return siguiente("OC", ultimo?.numero ?? null);
}

export async function siguienteNumeroRecepcion(tx: Tx): Promise<string> {
  const ultimo = await tx.recepcionCompra.findFirst({ orderBy: { numero: "desc" } });
  return siguiente("RC", ultimo?.numero ?? null);
}

export async function siguienteNumeroHojaRuta(tx: Tx): Promise<string> {
  const ultimo = await tx.hojaRuta.findFirst({ orderBy: { numero: "desc" } });
  return siguiente("HR", ultimo?.numero ?? null);
}

export async function siguienteCodigoCliente(tx: Tx): Promise<string> {
  const ultimo = await tx.cliente.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("CLI", ultimo?.codigo ?? null);
}

// El traslado no tiene tabla propia (son dos MovimientoKardex con la misma
// referencia): el correlativo se calcula contando cuántas referencias
// "TR-" distintas ya existen en el kardex.
export async function siguienteCodigoTraslado(tx: Tx): Promise<string> {
  const ultimo = await tx.movimientoKardex.findFirst({
    where: { origen: "TRASLADO", referencia: { startsWith: "TR-" } },
    orderBy: { referencia: "desc" },
    select: { referencia: true },
  });
  return siguiente("TR", ultimo?.referencia ?? null);
}

export async function siguienteCodigoConteo(tx: Tx): Promise<string> {
  const ultimo = await tx.conteoInventario.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("CI", ultimo?.codigo ?? null);
}

export async function siguienteNumeroCotizacion(tx: Tx): Promise<string> {
  const ultimo = await tx.cotizacion.findFirst({ orderBy: { numero: "desc" } });
  return siguiente("COT", ultimo?.numero ?? null);
}

export async function siguienteCodigoActivoFijo(tx: Tx): Promise<string> {
  const ultimo = await tx.activoFijo.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("AF", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEquipo(tx: Tx): Promise<string> {
  const ultimo = await tx.equipo.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("EQ", ultimo?.codigo ?? null);
}

export async function siguienteCodigoOrdenMantenimiento(tx: Tx): Promise<string> {
  const ultimo = await tx.ordenMantenimiento.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("OM", ultimo?.codigo ?? null);
}

export async function siguienteCodigoEmpleado(tx: Tx): Promise<string> {
  const ultimo = await tx.empleado.findFirst({ orderBy: { codigo: "desc" } });
  return siguiente("EMP", ultimo?.codigo ?? null);
}
