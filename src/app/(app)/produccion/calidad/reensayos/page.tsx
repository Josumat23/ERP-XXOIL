import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { MENSAJE_RESPALDO } from "@/lib/calibracion";
import { MENSAJE_DESTINO, resumenReensayos } from "@/lib/reensayos";
import { revisarReensayos } from "@/lib/reensayosConsulta";

const fechaCorta = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

export default async function ReensayosPage() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { lotes, medicionesEvaluadas, medicionesSinInstrumento } = await revisarReensayos(
    usuario.empresaId
  );
  const resumen = resumenReensayos(lotes);
  const unidadesAfuera = lotes.reduce((acc, l) => acc + l.unidadesDespachadas, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Qué hay que reensayar
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-5" style={{ color: "var(--epicor-texto-tenue)" }}>
        Todos los lotes cuyo ensayo se apoya en un instrumento sin calibración vigente, de todo el
        laboratorio y de una sola vez.{" "}
        <Link href="/produccion/calidad/instrumentos" className="hover:underline">
          Ver instrumentos
        </Link>
      </p>

      <div className="max-w-6xl">
        {lotes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Dato etiqueta="Lotes a revisar" valor={String(resumen.total)} />
            <Dato
              etiqueta="Ya en poder del cliente"
              valor={String(resumen.despachados)}
              alarma={resumen.despachados > 0}
            />
            <Dato etiqueta="Unidades despachadas" valor={formatNumero(unidadesAfuera, 0)} />
          </div>
        )}

        {lotes.length === 0 ? (
          <p className="text-sm borde-seccion" style={{ color: "var(--epicor-texto-tenue)" }}>
            {medicionesEvaluadas === 0
              ? "Todavía no hay ensayos que declaren con qué instrumento se midieron. En cuanto los haya, acá aparece lo que haya que reensayar."
              : medicionesEvaluadas === 1
                ? "La única medición con instrumento declarado tiene calibración vigente a su fecha. No hay nada que reensayar."
                : `Las ${medicionesEvaluadas} mediciones con instrumento declarado tienen calibración vigente a su fecha. No hay nada que reensayar.`}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Producto</th>
                <th>Ensayo</th>
                <th>Qué queda sin respaldo</th>
                <th>Dónde está el producto</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.loteId}>
                  <td className="font-medium align-top">
                    <Link href={`/produccion/lotes/${l.loteId}`} className="hover:underline">
                      {l.loteCodigo}
                    </Link>
                  </td>
                  <td className="align-top">{l.productoNombre}</td>
                  <td className="align-top">{fechaCorta.format(l.fechaEnsayo)}</td>
                  <td className="align-top">
                    <ul className="flex flex-col gap-1">
                      {l.mediciones.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{m.caracteristica}</span>{" "}
                          <span style={{ color: "var(--epicor-texto-tenue)" }}>
                            · {m.instrumentoCodigo}
                          </span>
                          <br />
                          <span
                            className={
                              m.respaldo === "EN_DUDA"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-700 dark:text-amber-400"
                            }
                          >
                            {MENSAJE_RESPALDO[m.respaldo]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="align-top">
                    <span
                      className={`insignia ${
                        l.destino === "DESPACHADO"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                          : l.destino === "EN_ALMACEN"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {MENSAJE_DESTINO[l.destino]}
                    </span>
                    {l.destino === "DESPACHADO" && (
                      <p className="text-sm mt-1">
                        {formatNumero(l.unidadesDespachadas, 0)} unidades en{" "}
                        {l.clientesAfectados === 1 ? "1 cliente" : `${l.clientesAfectados} clientes`}
                        {" · "}
                        <Link
                          href={`/produccion/lotes/recall?loteId=${l.loteId}`}
                          className="hover:underline text-blue-700 dark:text-blue-400"
                        >
                          ver a quiénes
                        </Link>
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {medicionesSinInstrumento > 0 && (
          <p className="text-sm mt-6 borde-seccion" style={{ color: "var(--epicor-texto-tenue)" }}>
            Hay {formatNumero(medicionesSinInstrumento, 0)} mediciones que no registran con qué
            instrumento se tomaron. No aparecen arriba porque no hay historial contra el cual
            derivar su respaldo — no porque estén respaldadas. El instrumento se captura desde que
            existe este módulo; los ensayos anteriores no lo traen y no se puede reconstruir.
          </p>
        )}

        <p className="text-sm mt-4" style={{ color: "var(--epicor-texto-tenue)" }}>
          Esta pantalla <strong>informa</strong>. Si una medición sin respaldo obliga a reensayar, a
          retener el lote o a avisarle al cliente es criterio de calidad, y el sistema no lo decide.
        </p>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  alarma = false,
}: {
  etiqueta: string;
  valor: string;
  alarma?: boolean;
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        {etiqueta}
      </p>
      <p
        className={`text-xl font-semibold mt-0.5 ${alarma ? "text-red-600 dark:text-red-400" : ""}`}
        style={alarma ? undefined : { color: "var(--epicor-texto)" }}
      >
        {valor}
      </p>
    </div>
  );
}
