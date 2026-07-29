import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatFecha, formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import BajaFormulario from "../BajaFormulario";
import VentaFormulario from "../VentaFormulario";
import { darDeBajaActivoFijo, venderActivoFijo } from "../actions";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  MAQUINARIA: "Maquinaria",
  VEHICULO: "Vehículo",
  EQUIPO_OFICINA: "Equipo de oficina",
  INMUEBLE: "Inmueble",
  OTRO: "Otro",
};

const NOMBRE_MES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default async function DetalleActivoFijoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [activo, activos, { tasaIgv }] = await Promise.all([
    prisma.activoFijo.findUnique({
      where: { id },
      include: {
        almacen: true,
        centroCosto: true,
        depreciaciones: { orderBy: [{ anio: "desc" }, { mes: "desc" }] },
      },
    }),
    prisma.activoFijo.findMany({ orderBy: { creadoEn: "desc" } }),
    obtenerConfiguracionEmpresa(),
  ]);
  if (!activo) notFound();

  const costo = activo.costoAdquisicion.toNumber();
  const residual = activo.valorResidual.toNumber();
  const acumulada = activo.depreciacionAcumulada.toNumber();
  const valorEnLibros = costo - acumulada;
  const cuotaMensual = (costo - residual) / (activo.vidaUtilAnios * 12);

  return (
    <div>
      <Link
        href="/finanzas/activos-fijos"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a activos fijos
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/finanzas/activos-fijos/nuevo"
        nuevoTexto="Nuevo activo"
        registros={activos.map((a) => ({
          id: a.id,
          href: `/finanzas/activos-fijos/${a.id}`,
          primario: a.nombre,
          secundario: a.codigo,
        }))}
      >
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {activo.nombre}
          </h1>
          <span
            className={`insignia ${
              activo.activo
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
            }`}
          >
            {activo.activo ? "Activo" : "Dado de baja"}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          {activo.codigo} · {ETIQUETA_CATEGORIA[activo.categoria]}
          {activo.almacen ? ` · ${activo.almacen.nombre}` : ""}
          {activo.centroCosto ? ` · Centro de costo: ${activo.centroCosto.codigo}` : ""} · Adquirido
          el {formatFecha(activo.fechaAdquisicion)} por {activo.usuarioNombre}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
          <Dato etiqueta="Costo de adquisición" valor={formatMoneda(costo)} />
          <Dato etiqueta="Valor residual" valor={formatMoneda(residual)} />
          <Dato etiqueta="Vida útil" valor={`${activo.vidaUtilAnios} años`} />
          <Dato etiqueta="Cuota mensual" valor={formatMoneda(cuotaMensual)} />
          <Dato etiqueta="Valor en libros" valor={formatMoneda(valorEnLibros)} />
        </div>

        {activo.notas && <p className="text-sm text-neutral-500 mt-4">Notas: {activo.notas}</p>}

        {!activo.activo && (
          <div className="mt-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              Dado de baja el {activo.fechaBaja ? formatFecha(activo.fechaBaja) : "—"}. Motivo:{" "}
              {activo.motivoBaja}
            </p>
            {activo.precioVenta != null && (() => {
              const precioVenta = activo.precioVenta.toNumber();
              const montoBase = precioVenta / (1 + tasaIgv.toNumber() / 100);
              const resultado = montoBase - valorEnLibros;
              return (
                <p className="text-sm text-neutral-500 mt-1">
                  Vendido en {formatMoneda(precioVenta)} (IGV incluido; base {formatMoneda(montoBase)}) —
                  valor en libros al momento de la baja: {formatMoneda(valorEnLibros)} (
                  {resultado >= 0 ? "utilidad" : "pérdida"} de {formatMoneda(Math.abs(resultado))}).
                </p>
              );
            })()}
          </div>
        )}

        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Historial de depreciación
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Período</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {activo.depreciaciones.map((d) => (
                <tr key={d.id}>
                  <td>
                    {NOMBRE_MES[d.mes - 1]} {d.anio}
                  </td>
                  <td className="text-right">{formatMoneda(d.monto)}</td>
                </tr>
              ))}
              {activo.depreciaciones.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-neutral-500 py-4">
                    Aún no se ha registrado depreciación para este activo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-xs text-neutral-500 mt-2">
            Depreciación acumulada: {formatMoneda(acumulada)} de {formatMoneda(costo - residual)}{" "}
            base depreciable ({formatNumero((acumulada / (costo - residual || 1)) * 100, 0)}%).
          </p>
        </section>

        <div className="mt-8">
          <PanelAdjuntos
            entidadTipo="ActivoFijo"
            entidadId={activo.id}
            rutaRevalidar={`/finanzas/activos-fijos/${activo.id}`}
          />
        </div>

        {activo.activo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
            <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Vender este activo
              </h2>
              <VentaFormulario accion={venderActivoFijo.bind(null, id)} valorEnLibros={valorEnLibros} />
            </section>
            <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Dar de baja sin venta (castigo)
              </h2>
              <BajaFormulario accion={darDeBajaActivoFijo.bind(null, id)} />
            </section>
          </div>
        )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
