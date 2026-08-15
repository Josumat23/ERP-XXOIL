import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ResolverInspeccionFormulario from "../ResolverInspeccionFormulario";

const ETIQUETA_RESULTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export default async function DetalleInspeccionCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { id } = await params;

  const [inspeccion, inspecciones] = await Promise.all([
    prisma.inspeccionCompra.findUnique({
      where: { id },
      include: {
        recepcionDetalle: {
          include: {
            insumo: true,
            recepcion: { include: { ordenCompra: { include: { proveedor: true } } } },
          },
        },
      },
    }),
    prisma.inspeccionCompra.findMany({
      include: { recepcionDetalle: { include: { insumo: true } } },
      orderBy: [{ resultado: "asc" }, { creadoEn: "desc" }],
    }),
  ]);
  if (!inspeccion) notFound();

  const detalle = inspeccion.recepcionDetalle;

  return (
    <div>
      <Link
        href="/logistica/inspeccion-compras"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a inspecciones
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={inspecciones.map((i) => ({
          id: i.id,
          href: `/logistica/inspeccion-compras/${i.id}`,
          primario: i.recepcionDetalle.insumo.nombre,
          secundario: ETIQUETA_RESULTADO[i.resultado],
        }))}
      >
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold mt-2" style={{ color: "var(--epicor-texto)" }}>
            {detalle.insumo.nombre}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            Proveedor: {detalle.recepcion.ordenCompra.proveedor.razonSocial} · Recepción{" "}
            {detalle.recepcion.numero} · OC{" "}
            <Link
              href={`/logistica/ordenes-compra/${detalle.recepcion.ordenCompraId}`}
              className="hover:underline font-mono"
            >
              {detalle.recepcion.ordenCompra.numero}
            </Link>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            <Dato
              etiqueta="Cantidad recibida"
              valor={`${formatNumero(detalle.cantidad, 3)} ${detalle.insumo.unidadMedida}`}
            />
            <Dato etiqueta="Costo unitario" valor={formatMoneda(detalle.costoUnitario)} />
            <Dato etiqueta="Resultado" valor={ETIQUETA_RESULTADO[inspeccion.resultado]} />
          </div>

          {inspeccion.resultado === "PENDIENTE" ? (
            <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Evaluar recepción
              </h2>
              <ResolverInspeccionFormulario inspeccionId={inspeccion.id} />
            </section>
          ) : (
            <section className="mt-8 text-sm">
              {inspeccion.observaciones && (
                <p className="text-neutral-500">{inspeccion.observaciones}</p>
              )}
              <p className="text-xs text-neutral-400 mt-2">
                Evaluado por {inspeccion.usuarioNombre} el{" "}
                {inspeccion.fecha &&
                  new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
                    inspeccion.fecha
                  )}
              </p>
            </section>
          )}
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border rounded-lg p-3" style={{ borderColor: "var(--epicor-borde)" }}>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        {etiqueta}
      </p>
      <p className="text-xl font-semibold mt-0.5" style={{ color: "var(--epicor-texto)" }}>
        {valor}
      </p>
    </div>
  );
}
