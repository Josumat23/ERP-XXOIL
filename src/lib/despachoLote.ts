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
  pedidoDetalle: { pedido: { numero: string; cliente: { id: string; razonSocial: string } } };
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
  /** Para poder ir a buscar a quién llamar sin adivinar por el nombre. */
  clienteId: string;
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
        clienteId: a.pedidoDetalle.pedido.cliente.id,
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
    clientes: new Set(destinos.map((d) => d.clienteId)).size,
  };
}

// ---------------------------------------------------------------------------
// De una venta a los lotes que salieron en ella.
//
// La dirección que faltaba. Un reclamo de cliente registra la factura, la causa
// y la descripción, pero no de qué LOTE salió el producto — y sin eso, quien
// investiga no sabe qué revisar ni si el problema alcanza a alguien más.
//
// El dato no falta: está en el mismo ledger que contesta el recall
// (`AsignacionLoteVenta`, cuyo comentario dice literalmente que existe para
// responder ante un reclamo de calidad). Nadie lo había conectado.
//
// No se declara nada nuevo en el reclamo: si la factura llevó tres lotes, los
// tres son candidatos y se muestran los tres. Decir «es este» eligiendo uno
// sería inventar una precisión que el documento no tiene.
// ---------------------------------------------------------------------------

/** Un envasado con el lote del que salió. */
export type EnvasadoConLote = EnvasadoDespachado & {
  loteGranel: {
    id: string;
    codigo: string;
    estado: string;
    formula: { producto: { nombre: string } };
  };
};

export type LoteEnUnaVenta = {
  loteGranelId: string;
  loteCodigo: string;
  productoNombre: string;
  estadoLote: string;
  /** Unidades vigentes de ese lote en esta venta. */
  unidades: number;
  envasados: { codigo: string; presentacion: string; cantidad: number }[];
};

/**
 * Los lotes que salieron en una venta, con cuánto de cada uno.
 *
 * Toma los envasados YA acotados a los renglones de esa venta: la resta
 * ASIGNADA − LIBERADA se hace por renglón, así que restringir antes mantiene
 * cada asignación con su liberación. Un renglón anulado o devuelto queda en
 * cero y no aparece — el cliente no lo tiene.
 *
 * Ordena por unidades, de más a menos: si hay que empezar a revisar por un
 * lote, es por el que más salió en esa venta.
 */
export function lotesDeUnaVenta(envasados: EnvasadoConLote[]): LoteEnUnaVenta[] {
  const porEnvasado = new Map(envasados.map((e) => [e.id, e]));
  const porLote = new Map<string, LoteEnUnaVenta>();

  for (const d of destinosDeLote(envasados)) {
    const envasado = porEnvasado.get(d.envasadoId);
    if (!envasado) continue;
    const lote = envasado.loteGranel;
    const fila = porLote.get(lote.id) ?? {
      loteGranelId: lote.id,
      loteCodigo: lote.codigo,
      productoNombre: lote.formula.producto.nombre,
      estadoLote: lote.estado,
      unidades: 0,
      envasados: [],
    };
    fila.unidades += d.cantidad;
    const suyo = fila.envasados.find((x) => x.codigo === d.envasadoCodigo);
    if (suyo) suyo.cantidad += d.cantidad;
    else
      fila.envasados.push({
        codigo: d.envasadoCodigo,
        presentacion: d.presentacionNombre,
        cantidad: d.cantidad,
      });
    porLote.set(lote.id, fila);
  }

  for (const fila of porLote.values()) {
    fila.envasados.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
  return [...porLote.values()].sort(
    (a, b) => b.unidades - a.unidades || a.loteCodigo.localeCompare(b.loteCodigo)
  );
}

// ---------------------------------------------------------------------------
// A quiénes hay que avisar.
//
// La pantalla de recall contesta «cuántos clientes» y «qué lotes», pero la
// lista de a quién llamar había que armarla a mano: entrar lote por lote,
// anotar los clientes y juntar los repetidos. Con tres lotes son tres pantallas
// y una hoja aparte; el día de un recall es cuando menos tiempo hay para eso.
//
// Es una CONSULTA y nada más. No registra a quién se avisó ni marca nada como
// notificado: cómo se comunica un recall, quién lo firma y qué se le pide al
// cliente son decisiones del negocio que nadie tomó, y no se inventan desde
// acá.
// ---------------------------------------------------------------------------

export type ClientePorAvisar = {
  clienteId: string;
  clienteNombre: string;
  /** Unidades vigentes en su poder, sumando todo el alcance. */
  unidades: number;
  /** Qué envases tiene, para que sepa qué buscar en su almacén. */
  envasados: { codigo: string; presentacion: string; cantidad: number }[];
  /** Los documentos por los que salió: es como el cliente ubica la entrega. */
  pedidos: string[];
  facturas: string[];
};

/**
 * Los clientes alcanzados, con lo que cada uno tiene.
 *
 * Se agrupa por id y no por razón social: dos clientes pueden llamarse
 * parecido, y juntarlos por el nombre mandaría a uno el aviso del otro.
 *
 * El orden es por unidades, de más a menos: si hay que empezar a llamar por
 * alguien, es por quien más producto tiene.
 */
export function clientesPorAvisar(destinos: DestinoDeLote[]): ClientePorAvisar[] {
  const porCliente = new Map<string, ClientePorAvisar>();

  for (const d of destinos) {
    const fila = porCliente.get(d.clienteId) ?? {
      clienteId: d.clienteId,
      clienteNombre: d.clienteNombre,
      unidades: 0,
      envasados: [],
      pedidos: [],
      facturas: [],
    };
    fila.unidades += d.cantidad;

    // El mismo envase puede llegarle en dos entregas: se suma, no se repite.
    const envase = fila.envasados.find((e) => e.codigo === d.envasadoCodigo);
    if (envase) envase.cantidad += d.cantidad;
    else
      fila.envasados.push({
        codigo: d.envasadoCodigo,
        presentacion: d.presentacionNombre,
        cantidad: d.cantidad,
      });

    if (!fila.pedidos.includes(d.pedidoNumero)) fila.pedidos.push(d.pedidoNumero);
    // Una guía facturada en varias facturas llega con los números juntos.
    for (const numero of (d.facturaNumero ?? "").split(", ").filter(Boolean)) {
      if (!fila.facturas.includes(numero)) fila.facturas.push(numero);
    }

    porCliente.set(d.clienteId, fila);
  }

  for (const fila of porCliente.values()) {
    fila.envasados.sort((a, b) => a.codigo.localeCompare(b.codigo));
    fila.pedidos.sort();
    fila.facturas.sort();
  }

  return [...porCliente.values()].sort(
    (a, b) => b.unidades - a.unidades || a.clienteNombre.localeCompare(b.clienteNombre)
  );
}
