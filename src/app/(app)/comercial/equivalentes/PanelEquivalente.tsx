import Link from "next/link";
import { formatMoneda, formatNumero } from "@/lib/format";
import { resumenCobertura, type Sugerencia } from "@/lib/sugerenciaEquivalente";

/**
 * «El cliente pide un producto de la competencia».
 *
 * Es un formulario GET y no un componente con estado: la búsqueda se resuelve
 * en el servidor, que es donde están los datos, y el resultado queda en la URL
 * — un vendedor puede pasarle el enlace a otro.
 */
export default function PanelEquivalente({
  competidores,
  elegidoId,
  nombreElegido,
  fuente,
  sugerencias,
  faltantesPorId,
}: {
  competidores: { id: string; etiqueta: string }[];
  elegidoId: string | null;
  nombreElegido: string | null;
  fuente: string | null;
  sugerencias: Sugerencia[];
  faltantesPorId: Map<string, string>;
}) {
  return (
    <section className="borde-seccion mb-6">
      <h2 className="text-lg font-semibold mb-1">¿El cliente pide un producto de la competencia?</h2>
      <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
        Elíjalo y el sistema propone el nuestro, con lo que cubre de su ficha y con qué presentación
        se puede cumplir.
      </p>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Producto que pidió</span>
          <select name="equivalenteA" defaultValue={elegidoId ?? ""} className="campo-input w-72">
            <option value="">Seleccione</option>
            {competidores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton-secundario">
          Buscar equivalente
        </button>
      </form>

      {competidores.length === 0 && (
        <p className="text-sm mt-3" style={{ color: "var(--epicor-texto-tenue)" }}>
          Todavía no hay productos de la competencia cargados. Se administran en{" "}
          <Link href="/catalogo/competencia" className="hover:underline">
            Productos de la competencia
          </Link>
          .
        </p>
      )}

      {elegidoId && (
        <div className="mt-4">
          <p className="text-sm mb-2">
            <strong>{nombreElegido}</strong>
            {fuente && (
              <span style={{ color: "var(--epicor-texto-tenue)" }}> · según {fuente}</span>
            )}
          </p>

          {sugerencias.length === 0 ? (
            /*
              No se inventa un reemplazo por parecido de nombre ni por
              categoría: si nadie declaró la equivalencia, el sistema no la
              supone. Decir «no hay» es la respuesta correcta.
            */
            <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
              No hay ningún producto declarado como equivalente. Se declaran en{" "}
              <Link href={`/catalogo/competencia/${elegidoId}`} className="hover:underline">
                su ficha
              </Link>
              , contra las especificaciones que ambos cumplen.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nuestro producto</th>
                    <th>Cobertura</th>
                    <th>Presentación</th>
                    <th>Precio</th>
                    <th>Disponible</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sugerencias.flatMap((s) =>
                    (s.presentaciones.length > 0
                      ? s.presentaciones
                      : [null]
                    ).map((p, i) => (
                      <tr key={p ? p.presentacionId : s.productoId}>
                        {i === 0 && (
                          <>
                            <td
                              rowSpan={Math.max(1, s.presentaciones.length)}
                              className="font-medium align-top"
                            >
                              {s.codigo} — {s.nombre}
                            </td>
                            <td
                              rowSpan={Math.max(1, s.presentaciones.length)}
                              className={
                                s.cobertura.esTotal
                                  ? "align-top"
                                  : "align-top text-amber-600 dark:text-amber-400 font-medium"
                              }
                            >
                              {resumenCobertura(s.cobertura)}
                              {/*
                                Lo que falta se nombra: quien cotiza tiene que
                                poder decirle al cliente qué no cubre, no
                                enterarse después.
                              */}
                              {s.cobertura.faltantes.length > 0 && (
                                <span className="block text-xs font-normal">
                                  no cubre:{" "}
                                  {s.cobertura.faltantes
                                    .map((f) => faltantesPorId.get(f) ?? f)
                                    .join(", ")}
                                </span>
                              )}
                              {s.justificacion && (
                                <span
                                  className="block text-xs font-normal"
                                  style={{ color: "var(--epicor-texto-tenue)" }}
                                >
                                  {s.justificacion}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        {p ? (
                          <>
                            <td>
                              <span className="font-mono text-xs">{p.sku}</span> {p.nombre}
                            </td>
                            <td>{formatMoneda(p.precio, p.moneda)}</td>
                            <td
                              className={
                                p.disponible <= 0
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : ""
                              }
                            >
                              {formatNumero(p.disponible, 0)}
                            </td>
                            <td>
                              <Link
                                href={`/comercial/cotizaciones/nuevo?presentacion=${p.presentacionId}`}
                                className="text-sm hover:underline"
                              >
                                Cotizar este
                              </Link>
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} style={{ color: "var(--epicor-texto-tenue)" }}>
                            Este producto no tiene presentaciones activas: no hay qué cotizar.
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
