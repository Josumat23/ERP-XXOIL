// ---------------------------------------------------------------------------
// A dónde salió un lote: qué clientes recibieron unidades suyas.
//
// La cuenta es siempre la misma —ASIGNADA menos LIBERADA por línea de venta—
// y estaba escrita a mano en cada pantalla que la necesitaba. Al ir a usarla
// por tercera vez se extrajo acá: una regla de negocio copiada es una regla
// que se corrige en un solo lugar y sigue mal en los otros dos.
//
// Importa para calidad, no solo para ventas: un lote cuyo ensayo quedó sin
// respaldo es una cosa si sigue en almacén y otra muy distinta si el cliente
// ya lo tiene.
// ---------------------------------------------------------------------------

export type AsignacionDeVenta = {
  tipo: "ASIGNADA" | "LIBERADA";
  cantidad: number;
  pedidoDetalleId: string;
  facturaDetalleId: string | null;
  guiaDetalleId: string | null;
  pedidoDetalle: { pedido: { numero: string; cliente: { razonSocial: string } } };
  facturaDetalle: { factura: { numero: string } } | null;
  guiaDetalle: {
    facturaAsignaciones: { facturaDetalle: { factura: { numero: string; estado: string } } }[];
  } | null;
};

export type EnvasadoDespachado = {
  id: string;
  codigo: string;
  presentacion: { nombre: string };
  asignacionesLote: AsignacionDeVenta[];
};

export type DestinoDeLote = {
  cantidad: number;
  clienteNombre: string;
  facturaNumero: string | null;
  pedidoNumero: string;
  envasadoId: string;
  envasadoCodigo: string;
  presentacionNombre: string;
};

/** La línea de venta a la que pertenece una asignación. */
const claveDeLinea = (a: AsignacionDeVenta) =>
  a.facturaDetalleId ?? a.guiaDetalleId ?? a.pedidoDetalleId;

/**
 * Los números de factura por los que salió una asignación.
 *
 * Una guía puede estar facturada en varias facturas, y las anuladas no
 * cuentan: el documento se anuló, la mercadería que amparaba se volvió a
 * asignar o se liberó. Devuelve `null` cuando no queda ninguna vigente —no
 * una cadena vacía, que en pantalla se lee como un dato en blanco en vez de
 * como «todavía no facturado».
 */
function facturasDe(a: AsignacionDeVenta): string | null {
  if (a.facturaDetalle) return a.facturaDetalle.factura.numero;
  const vigentes = (a.guiaDetalle?.facturaAsignaciones ?? [])
    .filter((f) => f.facturaDetalle.factura.estado !== "ANULADA")
    .map((f) => f.facturaDetalle.factura.numero);
  return vigentes.length > 0 ? vigentes.join(", ") : null;
}

/**
 * Los destinos vigentes de un lote, agregando todos sus envasados.
 *
 * Neto por línea de venta: si una factura se anuló o el cliente devolvió la
 * mercadería, esa cantidad ya no está en su poder y no debe contarse. Una
 * línea que quedó en cero o en negativo no aparece.
 */
export function destinosDeLote(envasados: EnvasadoDespachado[]): DestinoDeLote[] {
  const destinos: DestinoDeLote[] = [];
  for (const e of envasados) {
    const netoPorLinea = new Map<string, number>();
    for (const a of e.asignacionesLote) {
      const clave = claveDeLinea(a);
      const actual = netoPorLinea.get(clave) ?? 0;
      netoPorLinea.set(clave, actual + (a.tipo === "ASIGNADA" ? a.cantidad : -a.cantidad));
    }
    for (const a of e.asignacionesLote) {
      const clave = claveDeLinea(a);
      const cantidad = netoPorLinea.get(clave) ?? 0;
      if (cantidad <= 0) continue;
      // Se consume la línea para no repetirla por cada evento suyo: una
      // asignación y su liberación posterior son dos filas de lo mismo.
      netoPorLinea.set(clave, 0);
      destinos.push({
        cantidad,
        clienteNombre: a.pedidoDetalle.pedido.cliente.razonSocial,
        facturaNumero: facturasDe(a),
        pedidoNumero: a.pedidoDetalle.pedido.numero,
        envasadoId: e.id,
        envasadoCodigo: e.codigo,
        presentacionNombre: e.presentacion.nombre,
      });
    }
  }
  return destinos;
}

/** Cuánto salió y a cuántos clientes distintos. */
export function resumenDespacho(destinos: DestinoDeLote[]): {
  unidades: number;
  clientes: number;
} {
  return {
    unidades: destinos.reduce((acc, d) => acc + d.cantidad, 0),
    clientes: new Set(destinos.map((d) => d.clienteNombre)).size,
  };
}
