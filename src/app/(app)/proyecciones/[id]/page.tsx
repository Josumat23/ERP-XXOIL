import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import FichaTabs from "@/components/FichaTabs";
import BarraRanking from "@/components/BarraRanking";
import {
  calcularDemanda,
  calcularOperaciones,
  calcularFinanzas,
  type DetalleCalculado,
} from "@/lib/proyecciones";
import { actualizarDetalleProyeccion, refrescarFactorMacro } from "../actions";
import SupuestosMarketingFormulario from "./SupuestosMarketingFormulario";
import CajaMinimaFormulario from "./CajaMinimaFormulario";

const NOMBRE_TRIMESTRE: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3", 4: "T4" };

export default async function DetalleProyeccionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proyeccion = await prisma.proyeccion.findUnique({
    where: { id },
    include: { detalles: { include: { presentacion: { include: { producto: true } } } } },
  });
  if (!proyeccion) notFound();

  const detallesBase = proyeccion.detalles.map((d) => ({
    presentacionId: d.presentacionId,
    nombre: `${d.presentacion.producto.nombre} — ${d.presentacion.nombre}`,
    productoId: d.presentacion.productoId,
    contenidoKg: d.presentacion.contenidoKg.toNumber(),
    precio: d.presentacion.precio.toNumber(),
    costoPromedio: d.presentacion.costoPromedio.toNumber(),
    stock: d.presentacion.stock.toNumber(),
    stockMinimo: d.presentacion.stockMinimo.toNumber(),
    ventasBase: d.ventasBase.toNumber(),
    indiceEstacionalidad: d.indiceEstacionalidad.toNumber(),
    sinHistorico: d.ventasBase.toNumber() === 0,
    ajusteCualitativoPct: d.ajusteCualitativoPct.toNumber(),
    detalleId: d.id,
  }));

  const detalles: (DetalleCalculado & { detalleId: string })[] = calcularDemanda(
    detallesBase,
    proyeccion.crecimientoMercadoPct.toNumber(),
    proyeccion.factorCompetenciaPct.toNumber()
  ).map((d, i) => ({ ...d, detalleId: detallesBase[i].detalleId }));

  const [operaciones, finanzas] = await Promise.all([
    calcularOperaciones(detalles, proyeccion.anio, proyeccion.trimestre),
    calcularFinanzas(
      detalles,
      proyeccion.presupuestoPublicidad.toNumber(),
      proyeccion.cajaMinimaDeseada.toNumber(),
      proyeccion.anio,
      proyeccion.trimestre
    ),
  ]);

  const demandaTotal = detalles.reduce((acc, d) => acc + d.demandaProyectada, 0);
  const maxHorasEtapa = Math.max(operaciones.horasHombreProyectadas, operaciones.horasHombreDisponibles, 1);
  const excedeCapacidad =
    operaciones.horasHombreDisponibles > 0 && operaciones.horasHombreProyectadas > operaciones.horasHombreDisponibles;

  const contenidoMarketing = (
    <div className="flex flex-col gap-6">
      <SupuestosMarketingFormulario
        proyeccionId={proyeccion.id}
        crecimientoMercadoPct={proyeccion.crecimientoMercadoPct.toNumber()}
        factorCompetenciaPct={proyeccion.factorCompetenciaPct.toNumber()}
        presupuestoPublicidad={proyeccion.presupuestoPublicidad.toNumber()}
      />

      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Demanda proyectada por presentación
        </h2>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>Presentación</th>
              <th className="text-right">Ventas {NOMBRE_TRIMESTRE[proyeccion.trimestreBase]} (base)</th>
              <th>Estacionalidad</th>
              <th className="text-right">Ajuste cualitativo</th>
              <th className="text-right">Proyección {NOMBRE_TRIMESTRE[proyeccion.trimestre]}</th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((d) => (
              <tr key={d.presentacionId}>
                <td>{d.nombre}</td>
                <td className="text-right">{formatNumero(d.ventasBase, 0)} un.</td>
                <td>
                  {d.sinHistorico ? (
                    <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                      sin histórico
                    </span>
                  ) : (
                    <span className="insignia bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
                      ×{d.indiceEstacionalidad.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const ajuste = Number(formData.get("ajuste"));
                      const indiceManual = formData.get("indice");
                      await actualizarDetalleProyeccion(
                        d.detalleId,
                        Number.isFinite(ajuste) ? ajuste : 0,
                        indiceManual !== null && indiceManual !== "" ? Number(indiceManual) : undefined
                      );
                    }}
                    className="flex items-center justify-end gap-1"
                  >
                    {d.sinHistorico && (
                      <input
                        name="indice"
                        type="number"
                        step="0.01"
                        placeholder="índice"
                        className="campo-input w-16 py-1 text-xs"
                      />
                    )}
                    <input
                      name="ajuste"
                      type="number"
                      step="0.1"
                      defaultValue={d.ajusteCualitativoPct}
                      className="campo-input w-16 py-1 text-xs"
                    />
                    <span className="text-xs text-neutral-400">%</span>
                    <button type="submit" className="text-xs text-neutral-500 hover:underline">
                      Guardar
                    </button>
                  </form>
                </td>
                <td className="text-right font-semibold">{formatNumero(d.demandaProyectada, 0)} un.</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-neutral-500 mt-2">
          Estacionalidad = venta histórica de {NOMBRE_TRIMESTRE[proyeccion.trimestre]} (años anteriores) ÷ venta
          de {NOMBRE_TRIMESTRE[proyeccion.trimestreBase]} (mismos años). Sin histórico suficiente, ingresá el
          índice manualmente.
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi etiqueta="Demanda total proyectada" valor={`${formatNumero(demandaTotal, 0)} un.`} />
        <Kpi etiqueta="Ventas proyectadas" valor={formatMoneda(finanzas.ventasProyectadas)} />
        <Kpi
          etiqueta="Factor macro (BCRP)"
          valor={
            proyeccion.macroPbiManufacturaVar !== null
              ? `PBI manuf. ${proyeccion.macroPbiManufacturaVar.toNumber().toFixed(1)}%`
              : "no disponible"
          }
          detalle={
            proyeccion.macroActualizadoEn
              ? `actualizado ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(proyeccion.macroActualizadoEn)}`
              : undefined
          }
        />
      </div>
    </div>
  );

  const contenidoOperaciones = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi etiqueta="Kg de granel a producir" valor={`${formatNumero(operaciones.kgGranelTotal, 0)} kg`} />
        <Kpi etiqueta="Costo de producción proy." valor={formatMoneda(operaciones.costoProduccionProyectado)} />
        <Kpi
          etiqueta="Horas-hombre proyectadas"
          valor={`${formatNumero(operaciones.horasHombreProyectadas, 0)} h-h`}
          detalle={
            operaciones.horasHombreDisponibles > 0
              ? `de ${formatNumero(operaciones.horasHombreDisponibles, 0)} disponibles`
              : "capacidad no configurada"
          }
          alerta={excedeCapacidad}
        />
        <Kpi etiqueta="Insumos a comprar" valor={String(operaciones.insumos.filter((i) => i.aComprar > 0).length)} />
      </div>

      {operaciones.horasHombreDisponibles > 0 && (
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Capacidad de planta</h2>
          <div className="mt-4">
            <BarraRanking
              etiqueta="Mano de obra"
              valor={operaciones.horasHombreProyectadas}
              max={maxHorasEtapa}
              formatoValor={(v) => `${formatNumero(v, 0)} h-h`}
            />
          </div>
          {excedeCapacidad && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              La demanda proyectada supera la capacidad disponible — evaluar horas extra, subcontrata o mover
              producción al siguiente trimestre.
            </p>
          )}
          {operaciones.capacidadPorAlmacen.length > 1 && (
            <ul className="text-xs text-neutral-500 mt-3 flex flex-col gap-0.5">
              {operaciones.capacidadPorAlmacen.map((a) => (
                <li key={a.almacenId}>
                  {a.almacenNombre}: {formatNumero(a.horasDisponibles, 0)} h-h disponibles
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Insumos: consumo proyectado vs. stock
        </h2>
        {operaciones.insumos.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-3">Sin producción proyectada este trimestre.</p>
        ) : (
          <table className="tabla mt-3">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="text-right">Stock actual</th>
                <th className="text-right">Consumo proyectado</th>
                <th className="text-right">A comprar</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.insumos.map((i) => (
                <tr key={i.insumoId}>
                  <td>{i.nombre}</td>
                  <td className="text-right">
                    {formatNumero(i.stock, 0)} {i.unidadMedida}
                  </td>
                  <td className="text-right">
                    {formatNumero(i.consumoProyectado, 0)} {i.unidadMedida}
                  </td>
                  <td
                    className={`text-right ${i.aComprar > 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-neutral-400"}`}
                  >
                    {i.aComprar > 0 ? `${formatNumero(i.aComprar, 0)} ${i.unidadMedida}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {operaciones.presentacionesSinFormula.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            Sin fórmula activa (no se pudo estimar producción): {operaciones.presentacionesSinFormula.join(", ")}
          </p>
        )}
      </section>
    </div>
  );

  const contenidoFinanzas = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi etiqueta="Ventas proyectadas" valor={formatMoneda(finanzas.ventasProyectadas)} />
        <Kpi etiqueta="Utilidad operativa proy." valor={formatMoneda(finanzas.utilidadOperativa)} />
        <Kpi
          etiqueta="Flujo de caja proyectado"
          valor={formatMoneda(finanzas.flujoCajaProyectado)}
          alerta={finanzas.flujoCajaProyectado < proyeccion.cajaMinimaDeseada.toNumber()}
        />
        <Kpi
          etiqueta="Monto a financiar"
          valor={formatMoneda(finanzas.necesidadFinanciamiento)}
          alerta={finanzas.necesidadFinanciamiento > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Estado de resultados proyectado — {NOMBRE_TRIMESTRE[proyeccion.trimestre]} {proyeccion.anio}
          </h2>
          <table className="tabla mt-3">
            <tbody>
              <FilaFin etiqueta="Ventas netas" valor={finanzas.ventasProyectadas} />
              <FilaFin etiqueta="(−) Costo de ventas" valor={-finanzas.costoVentasProyectado} />
              <FilaFin etiqueta="Utilidad bruta" valor={finanzas.utilidadBruta} destacada />
              <FilaFin etiqueta="(−) Comisiones" valor={-finanzas.comisionesProyectadas} />
              <FilaFin etiqueta="(−) Publicidad + gastos fijos" valor={-finanzas.gastosOperativosProyectados} />
              <FilaFin etiqueta="Utilidad operativa" valor={finanzas.utilidadOperativa} destacada />
            </tbody>
          </table>
          <CajaMinimaFormulario
            proyeccionId={proyeccion.id}
            cajaMinimaDeseada={proyeccion.cajaMinimaDeseada.toNumber()}
          />
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Cascada de financiamiento (si falta caja)
          </h2>
          <div className="flex flex-col gap-2 mt-4">
            {finanzas.cascada.map((linea) => (
              <div
                key={linea.etiqueta}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-[var(--epicor-borde-suave)]"
              >
                <span>
                  {linea.etiqueta} <span className="text-xs text-neutral-400">({linea.tasa.toFixed(1)}%)</span>
                </span>
                <span className="font-medium">{formatMoneda(linea.monto)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--epicor-azul)" }}>
              <span>Total a financiar</span>
              <span>{formatMoneda(finanzas.necesidadFinanciamiento)}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            Mismo orden y tasas que Configuración → Empresa: usa primero lo más barato/disponible (cuentas por
            cobrar por vencer, luego corto plazo) antes de largo plazo.
          </p>
          <Link href="/configuracion/empresa" className="text-xs text-neutral-500 hover:underline mt-2 inline-block">
            Editar tasas y montos →
          </Link>
        </section>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl">
      <Link href="/proyecciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proyecciones
      </Link>
      <div className="flex items-center justify-between mt-1">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Proyección {NOMBRE_TRIMESTRE[proyeccion.trimestre]} {proyeccion.anio}
        </h1>
        <form
          action={async () => {
            "use server";
            await refrescarFactorMacro(proyeccion.id);
          }}
        >
          <button type="submit" className="boton-secundario text-xs px-2 py-1">
            Actualizar factor macro (BCRP)
          </button>
        </form>
      </div>
      <p className="text-neutral-500 mt-1">
        Basada en {NOMBRE_TRIMESTRE[proyeccion.trimestreBase]} {proyeccion.anioBase}
      </p>

      <div className="mt-6">
        <FichaTabs
          pestanas={[
            { id: "mkt", etiqueta: "Marketing", contenido: contenidoMarketing },
            { id: "ops", etiqueta: "Operaciones", contenido: contenidoOperaciones },
            { id: "fin", etiqueta: "Finanzas", contenido: contenidoFinanzas },
          ]}
        />
      </div>
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <p className="text-sm text-neutral-500">{etiqueta}</p>
      <p
        className={`text-xl font-semibold mt-1 ${alerta ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"}`}
      >
        {valor}
      </p>
      {detalle && <p className="text-xs text-neutral-400 mt-0.5">{detalle}</p>}
    </div>
  );
}

function FilaFin({ etiqueta, valor, destacada = false }: { etiqueta: string; valor: number; destacada?: boolean }) {
  return (
    <tr className={destacada ? "bg-amber-500/10" : ""}>
      <td className={destacada ? "font-semibold" : "text-neutral-600 dark:text-neutral-400"}>{etiqueta}</td>
      <td
        className={`text-right ${destacada ? "font-semibold" : ""} ${valor < 0 ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {formatMoneda(valor)}
      </td>
    </tr>
  );
}
