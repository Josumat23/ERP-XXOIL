export type FuenteAcuerdo = {
  acuerdoId: string;
  acuerdoLineaId: string;
  proveedorId: string;
  proveedorNombre: string;
  precioUnitario: number;
  moneda: "PEN" | "USD";
  tipoCambio: number;
  saldo: number;
};

export function seleccionarFuenteAprovisionamiento(
  cantidad: number,
  candidatas: FuenteAcuerdo[],
): FuenteAcuerdo | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;

  return (
    candidatas
      .filter(
        (fuente) =>
          Number.isFinite(fuente.saldo) &&
          fuente.saldo + 1e-9 >= cantidad &&
          Number.isFinite(fuente.precioUnitario) &&
          fuente.precioUnitario >= 0 &&
          Number.isFinite(fuente.tipoCambio) &&
          fuente.tipoCambio > 0,
      )
      .sort((a, b) => {
        const costoA = a.precioUnitario * (a.moneda === "USD" ? a.tipoCambio : 1);
        const costoB = b.precioUnitario * (b.moneda === "USD" ? b.tipoCambio : 1);
        return costoA - costoB || a.acuerdoLineaId.localeCompare(b.acuerdoLineaId);
      })[0] ?? null
  );
}
