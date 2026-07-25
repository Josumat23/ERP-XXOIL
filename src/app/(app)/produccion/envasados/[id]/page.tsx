import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

export default async function DetalleEnvasadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [envasado, envasados] = await Promise.all([
    prisma.envasado.findUnique({
      where: { id },
      include: {
        loteGranel: { include: { formula: { include: { producto: true } } } },
        presentacion: true,
        insumos: { include: { insumo: true } },
      },
    }),
    prisma.envasado.findMany({ include: { presentacion: true }, orderBy: { fecha: "desc" } }),
  ]);
  if (!envasado) notFound();

  return (
    <div>
      <Link href="/produccion/envasados" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a envasados
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/envasados/nuevo"
        nuevoTexto="Nuevo envasado"
        registros={envasados.map((e) => ({
          id: e.id,
          href: `/produccion/envasados/${e.id}`,
          primario: e.codigo,
          secundario: e.presentacion.nombre,
        }))}
      >
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mt-2" style={{ color: "var(--epicor-texto)" }}>
          Envasado {envasado.codigo}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          {envasado.loteGranel.formula.producto.nombre} — {envasado.presentacion.nombre} · Lote{" "}
          <Link href={`/produccion/lotes/${envasado.loteGranelId}`} className="hover:underline font-mono">
            {envasado.loteGranel.codigo}
          </Link>{" "}
          · Registrado por {envasado.usuarioNombre} el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
            envasado.fecha
          )}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <Dato etiqueta="Unidades" valor={String(envasado.unidades)} />
          <Dato etiqueta="Kg de granel consumidos" valor={formatNumero(envasado.kgConsumidos, 2)} />
          <Dato etiqueta="Costo total" valor={formatMoneda(envasado.costoTotal)} />
          <Dato etiqueta="Costo unitario" valor={formatMoneda(envasado.costoUnitario)} />
        </div>

        <p className="text-xs mt-3" style={{ color: "var(--epicor-texto-tenue)" }}>
          Mano de obra: {formatNumero(envasado.horasManoObra, 2)} h = {formatMoneda(envasado.costoManoObra)}
        </p>

        <section className="mt-8">
          <h2 className="font-medium" style={{ color: "var(--epicor-texto)" }}>
            Envases y etiquetas consumidos
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {envasado.insumos.map((i) => (
                <tr key={i.id}>
                  <td>{i.insumo.nombre}</td>
                  <td className="text-right">
                    {formatNumero(i.cantidad, 3)} {i.insumo.unidadMedida}
                  </td>
                </tr>
              ))}
              {envasado.insumos.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-neutral-500 py-4">
                    Sin envases/etiquetas registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border rounded-lg p-3" style={{ borderColor: "var(--epicor-borde)" }}>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>{etiqueta}</p>
      <p className="text-xl font-semibold mt-0.5" style={{ color: "var(--epicor-texto)" }}>{valor}</p>
    </div>
  );
}
