import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import EnvasadoFormulario from "../EnvasadoFormulario";

export default async function NuevoEnvasadoPage({
  searchParams,
}: {
  searchParams: Promise<{ loteId?: string }>;
}) {
  const { loteId } = await searchParams;

  const [lotes, presentaciones, insumos, envasados] = await Promise.all([
    prisma.loteGranel.findMany({
      where: { estado: "APROBADO", kgDisponibles: { gt: 0 } },
      include: { formula: { include: { producto: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.presentacion.findMany({ where: { activo: true }, orderBy: { sku: "asc" } }),
    prisma.insumo.findMany({
      where: { activo: true, tipo: { in: ["ENVASE", "ETIQUETA"] } },
      orderBy: { codigo: "asc" },
    }),
    prisma.envasado.findMany({ include: { presentacion: true }, orderBy: { fecha: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/produccion/envasados" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a envasados
      </Link>
      <h1 className="text-xl font-bold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Nuevo envasado
      </h1>
      <p className="text-[13px] mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Consume granel aprobado más envases y etiquetas, y genera stock de la presentación elegida.
      </p>

      <PanelMaestroDetalle
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
        <EnvasadoFormulario
          loteIdInicial={loteId}
          lotes={lotes.map((l) => ({
            id: l.id,
            etiqueta: `${l.codigo} — ${l.formula.producto.nombre} (${l.kgDisponibles.toNumber().toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg disp.)`,
            productoId: l.formula.productoId,
            kgDisponibles: l.kgDisponibles.toNumber(),
          }))}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.sku} — ${p.nombre} (${p.contenidoKg.toNumber()} kg c/u)`,
            productoId: p.productoId,
            contenidoKg: p.contenidoKg.toNumber(),
          }))}
          insumos={insumos.map((i) => ({
            id: i.id,
            etiqueta: `${i.codigo} — ${i.nombre}`,
            stock: i.stock.toNumber(),
            unidad: i.unidadMedida,
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
