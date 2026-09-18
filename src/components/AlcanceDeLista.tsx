// ---------------------------------------------------------------------------
// Cuántas opciones se están mostrando de cuántas hay.
//
// Un selector acotado SIN DECIRLO es peor que uno largo: quien no encuentra lo
// suyo concluye que no existe. Con volumen real esa conclusión es cara —el día
// de un recall, o registrando un reclamo contra una factura que sí está pero
// quedó fuera de las últimas cincuenta.
//
// Vivía dentro de la pantalla de trazabilidad. Al necesitarlo la tercera lista
// se extrajo acá en vez de copiarse: tres mensajes que dicen lo mismo con
// palabras distintas se desincronizan, y el que quede viejo va a ser justo el
// de la pantalla que menos se mira.
// ---------------------------------------------------------------------------

export default function AlcanceDeLista({
  mostrados,
  totales,
  tope,
  busqueda,
  queBusca,
}: {
  mostrados: number;
  totales: number;
  tope: number;
  /** El texto buscado, si se buscó algo. */
  busqueda?: string;
  /** Qué se está listando, en plural: «lotes», «facturas del cliente». */
  queBusca: string;
}) {
  const clase = "text-xs text-neutral-500 -mt-2 mb-1";
  if (busqueda) {
    if (mostrados === 0) {
      return (
        <p className={clase}>
          Ningún resultado para «{busqueda}» entre los {totales} {queBusca}.
        </p>
      );
    }
    return (
      <p className={clase}>
        {mostrados} de {totales} {queBusca} coinciden con «{busqueda}»
        {mostrados >= tope ? ` (se muestran los ${tope} más recientes)` : ""}.
      </p>
    );
  }
  if (totales > mostrados) {
    return (
      <p className={clase}>
        Se muestran los {mostrados} más recientes de {totales} {queBusca}. Use el filtro para
        encontrar el resto.
      </p>
    );
  }
  return null;
}
