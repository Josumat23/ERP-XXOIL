import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import LoteFormulario from "../LoteFormulario";

export default async function NuevoLotePage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const [formulas, lotes, lotesRechazados] = await Promise.all([
    prisma.formula.findMany({
      where: { activo: true },
      include: { producto: true, detalles: { include: { insumo: true } } },
      orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
    }),
    prisma.loteGranel.findMany({
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
    }),
    prisma.loteGranel.findMany({
      where: { estado: "RECHAZADO", disposicionRechazo: null },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaFin: "desc" },
    }),
  ]);

  return (
    <div>
      <Link href="/produccion/lotes" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a órdenes de producción
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Nueva orden de producción
      </h1>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Al crear el lote se descuentan los insumos de la fórmula (escalados a los kg objetivo) y el
        consumo queda registrado en el kardex.
      </p>

      <PanelMaestroDetalle
        nuevoHref="/produccion/lotes/nuevo"
        nuevoTexto="Nueva orden"
        registros={lotes.map((l) => ({
          id: l.id,
          href: `/produccion/lotes/${l.id}`,
          primario: l.codigo,
          secundario: l.formula.producto.nombre,
        }))}
      >
      <div className="max-w-2xl">
        <LoteFormulario
          formulas={formulas.map((f) => ({
            id: f.id,
            etiqueta: `${f.producto.nombre} — v${f.version} (batch ${f.rendimientoKg.toNumber()} kg)`,
            rendimientoKg: f.rendimientoKg.toNumber(),
            detalles: f.detalles.map((d) => ({
              nombre: d.insumo.nombre,
              unidad: d.insumo.unidadMedida,
              cantidad: d.cantidad.toNumber(),
              stock: d.insumo.stock.toNumber(),
            })),
          }))}
          lotesRechazados={lotesRechazados.map((l) => ({
            id: l.id,
            etiqueta: `${l.codigo} — ${l.formula.producto.nombre} (${l.kgProducidos.toNumber()} kg rechazados)`,
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
