import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import FormulaFormulario from "../FormulaFormulario";

export default async function NuevaFormulaPage() {
  const [productos, insumos, formulas] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.insumo.findMany({
      where: { activo: true, tipo: "MATERIA_PRIMA" },
      orderBy: { codigo: "asc" },
    }),
    prisma.formula.findMany({
      include: { producto: true },
      orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
    }),
  ]);

  return (
    <div>
      <Link href="/produccion/formulas" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a fórmulas
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Nueva versión de fórmula
      </h1>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        La versión se asigna automáticamente (siguiente número para el producto elegido).
      </p>

      <PanelMaestroDetalle
        nuevoHref="/produccion/formulas/nueva"
        nuevoTexto="Nueva versión"
        registros={formulas.map((f) => ({
          id: f.id,
          href: `/produccion/formulas/${f.id}`,
          primario: f.producto.nombre,
          secundario: `v${f.version}`,
        }))}
      >
      <div className="max-w-2xl">
        <FormulaFormulario
          productos={productos}
          insumos={insumos.map((i) => ({
            id: i.id,
            codigo: i.codigo,
            nombre: i.nombre,
            unidadMedida: i.unidadMedida,
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
