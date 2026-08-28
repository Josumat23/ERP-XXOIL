export type EscalonPrecioPedido = {
  cantidadMinima: number;
  precio: number;
};

export type CondicionPrecioPedido = {
  precioLista: number;
  origenPrecio: "BASE" | "ESCALON";
  cantidadMinimaPrecio: number | null;
  descuentoPct: number;
  descuentoMonto: number;
  precioUnitario: number;
  subtotalBruto: number;
  subtotal: number;
};

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function resolverCondicionPrecioPedido(params: {
  precioBase: number;
  escalones: EscalonPrecioPedido[];
  cantidad: number;
  descuentoCanalPct: number;
}): CondicionPrecioPedido {
  const { precioBase, escalones, cantidad, descuentoCanalPct } = params;
  if (!Number.isFinite(precioBase) || precioBase < 0) {
    throw new Error("El precio base de la presentación es inválido.");
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser un entero mayor a cero.");
  }
  if (!Number.isFinite(descuentoCanalPct) || descuentoCanalPct < 0 || descuentoCanalPct > 100) {
    throw new Error("El descuento del canal debe estar entre 0 y 100%.");
  }

  const escalon = escalones
    .filter(
      (candidato) =>
        Number.isInteger(candidato.cantidadMinima) &&
        candidato.cantidadMinima > 0 &&
        candidato.cantidadMinima <= cantidad &&
        Number.isFinite(candidato.precio) &&
        candidato.precio >= 0
    )
    .sort((a, b) => b.cantidadMinima - a.cantidadMinima)[0];
  const precioLista = redondearMoneda(escalon?.precio ?? precioBase);
  const precioUnitario = redondearMoneda(precioLista * (1 - descuentoCanalPct / 100));
  const subtotalBruto = redondearMoneda(precioLista * cantidad);
  const subtotal = redondearMoneda(precioUnitario * cantidad);

  return {
    precioLista,
    origenPrecio: escalon ? "ESCALON" : "BASE",
    cantidadMinimaPrecio: escalon?.cantidadMinima ?? null,
    descuentoPct: descuentoCanalPct,
    descuentoMonto: redondearMoneda(subtotalBruto - subtotal),
    precioUnitario,
    subtotalBruto,
    subtotal,
  };
}

export function calcularTotalesPedido(
  lineas: Array<Pick<CondicionPrecioPedido, "subtotalBruto" | "descuentoMonto" | "subtotal">>,
  tasaIgv: number
) {
  if (!Number.isFinite(tasaIgv) || tasaIgv < 0 || tasaIgv > 100) {
    throw new Error("La tasa de IGV configurada es inválida.");
  }
  const subtotalBruto = redondearMoneda(
    lineas.reduce((acumulado, linea) => acumulado + linea.subtotalBruto, 0)
  );
  const descuentoTotal = redondearMoneda(
    lineas.reduce((acumulado, linea) => acumulado + linea.descuentoMonto, 0)
  );
  const total = redondearMoneda(lineas.reduce((acumulado, linea) => acumulado + linea.subtotal, 0));
  const igv = redondearMoneda(total * tasaIgv / 100);
  return {
    subtotalBruto,
    descuentoTotal,
    total,
    tasaIgv,
    igv,
    totalConIgv: redondearMoneda(total + igv),
  };
}
