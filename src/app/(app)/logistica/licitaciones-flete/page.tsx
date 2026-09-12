import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha, formatMoneda } from "@/lib/format";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  OFERTAS_MINIMAS,
  montoComparable,
  ofertaMasBarata,
} from "@/lib/licitacionFlete";
import {
  AdjudicarFormulario,
  DesiertaFormulario,
  NuevaLicitacionFormulario,
  OfertaFormulario,
} from "./LicitacionFormularios";

const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  ADJUDICADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  DESIERTA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function LicitacionesFletePage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const puedeEditar = await puedeRealizar(usuario, "materiales", "editar");

  const empresaId = await obtenerEmpresaActivaId();
  const [licitaciones, transportistas, ubigeos] = await Promise.all([
    prisma.licitacionFlete.findMany({
      where: { empresaId },
      include: {
        ofertas: { include: { transportista: { select: { razonSocial: true } } } },
        guias: { select: { id: true, numero: true } },
      },
      orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
      take: 50,
    }),
    prisma.transportista.findMany({
      where: { empresaId, activo: true },
      select: { id: true, razonSocial: true, ruc: true },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.ubigeo.findMany({
      select: { id: true, departamento: true, provincia: true, distrito: true },
      orderBy: [{ departamento: "asc" }, { provincia: "asc" }, { distrito: "asc" }],
    }),
  ]);

  const opcionesTransportista = transportistas.map((t) => ({
    id: t.id,
    etiqueta: `${t.razonSocial}${t.ruc ? ` — ${t.ruc}` : ""}`,
  }));
  const opcionesUbigeo = ubigeos.map((u) => ({
    id: u.id,
    etiqueta: `${u.departamento} / ${u.provincia} / ${u.distrito}`,
  }));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Licitaciones de flete
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        Comparar cotizaciones de{" "}
        <Link href="/logistica/transportistas" className="text-[var(--epicor-azul)] hover:underline">
          transportistas
        </Link>{" "}
        para un tramo antes de contratarlo. Mismas reglas que el RFQ de compras:{" "}
        <strong>{OFERTAS_MINIMAS} ofertas como mínimo</strong>, justificación escrita, y quien
        solicita no adjudica. Adjudicar <strong>no emite la guía</strong>: la guía documenta un
        traslado que ocurre y se emite cuando el camión sale.
      </p>

      {puedeEditar && transportistas.length === 0 && (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          No hay transportistas activos:{" "}
          <Link href="/logistica/transportistas" className="underline">
            regístrelos primero
          </Link>{" "}
          para poder cargar sus cotizaciones.
        </p>
      )}

      {puedeEditar && <NuevaLicitacionFormulario ubigeos={opcionesUbigeo} />}

      <div className="mt-6 flex flex-col gap-4">
        {licitaciones.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
            Todavía no hay licitaciones de flete.
          </p>
        )}

        {licitaciones.map((l) => {
          const comparables = l.ofertas.map((o) => ({
            id: o.id,
            transportistaId: o.transportistaId,
            monto: o.monto.toNumber(),
            moneda: o.moneda,
            tipoCambio: o.tipoCambio.toNumber(),
            diasTransito: o.diasTransito,
          }));
          const barata = ofertaMasBarata(comparables);
          const adjudicada = l.ofertas.find((o) => o.estado === "ADJUDICADA");

          return (
            <section key={l.id} className="borde-seccion">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                    {l.titulo}{" "}
                    <span className="font-mono text-xs text-neutral-400">{l.numero}</span>
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {l.origen} → {l.destino} · {l.pesoEstimadoKg.toNumber()} kg · requerido{" "}
                    {formatFecha(l.fechaRequerida)}
                    {l.fechaLimite && ` · ofertas hasta ${formatFecha(l.fechaLimite)}`}
                    {" · solicitó "}
                    {l.usuarioNombre}
                  </p>
                </div>
                <span className={`insignia ${COLOR_ESTADO[l.estado]}`}>{l.estado}</span>
              </div>

              {l.notas && <p className="mt-2 text-xs text-neutral-500">{l.notas}</p>}

              {l.ofertas.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Transportista</th>
                        <th className="text-right">Monto</th>
                        <th className="text-right">Comparable (S/)</th>
                        <th className="text-right">Tránsito</th>
                        <th>Válida hasta</th>
                        <th>Estado</th>
                        {puedeEditar && l.estado === "ABIERTA" && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {comparables.map((c) => {
                        const oferta = l.ofertas.find((o) => o.id === c.id)!;
                        const comparable = montoComparable(c);
                        const esBarata = barata?.id === c.id;
                        const sobrecosto = barata ? comparable - montoComparable(barata) : 0;
                        return (
                          <tr key={c.id}>
                            <td>
                              {oferta.transportista.razonSocial}
                              {esBarata && (
                                <span className="ml-2 insignia bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                                  más barata
                                </span>
                              )}
                            </td>
                            <td className="text-right">{formatMoneda(c.monto, c.moneda)}</td>
                            <td className="text-right">{formatMoneda(comparable)}</td>
                            <td className="text-right">{c.diasTransito} d</td>
                            <td className="text-xs">
                              {oferta.validaHasta ? formatFecha(oferta.validaHasta) : "—"}
                            </td>
                            <td className="text-xs">{oferta.estado}</td>
                            {puedeEditar && l.estado === "ABIERTA" && (
                              <td>
                                {l.ofertas.length >= OFERTAS_MINIMAS ? (
                                  <AdjudicarFormulario
                                    licitacionId={l.id}
                                    ofertaId={c.id}
                                    esLaMasBarata={sobrecosto <= 0}
                                    sobrecosto={Math.round(Math.max(0, sobrecosto) * 100) / 100}
                                  />
                                ) : (
                                  <span className="text-xs text-neutral-500">
                                    Faltan ofertas para adjudicar
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {l.estado === "ABIERTA" && puedeEditar && (
                <div className="mt-4 flex flex-col gap-3">
                  <OfertaFormulario licitacionId={l.id} transportistas={opcionesTransportista} />
                  {l.ofertas.length < OFERTAS_MINIMAS && (
                    <p className="text-xs text-neutral-500">
                      Hay {l.ofertas.length} de {OFERTAS_MINIMAS} ofertas mínimas. Una sola
                      cotización no es una comparación.
                    </p>
                  )}
                  <DesiertaFormulario licitacionId={l.id} />
                </div>
              )}

              {l.estado === "ADJUDICADA" && adjudicada && (
                <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm dark:border-green-900 dark:bg-green-950/20">
                  <p className="text-neutral-700 dark:text-neutral-300">
                    Adjudicada a <strong>{adjudicada.transportista.razonSocial}</strong> por{" "}
                    {formatMoneda(adjudicada.monto, adjudicada.moneda)} en{" "}
                    {adjudicada.diasTransito} días, por {l.adjudicadaPorNombre} el{" "}
                    {l.adjudicadaEn && formatFecha(l.adjudicadaEn)}.
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Justificación:</span>{" "}
                    {l.justificacionAdjudicacion}
                  </p>
                  {l.guias.length > 0 && (
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      Guías emitidas:{" "}
                      {l.guias.map((g) => (
                        <Link
                          key={g.id}
                          href={`/logistica/guias-remision/${g.id}`}
                          className="mr-2 font-mono text-[var(--epicor-azul)] hover:underline"
                        >
                          {g.numero}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              )}

              {l.estado === "DESIERTA" && (
                <p className="mt-3 text-sm text-neutral-500">
                  <span className="font-medium">Desierta:</span> {l.motivoDesierta}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
