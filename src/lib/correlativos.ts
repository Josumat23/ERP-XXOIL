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
