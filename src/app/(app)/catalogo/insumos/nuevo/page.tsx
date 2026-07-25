import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import InsumoFormulario from "../InsumoFormulario";
import { crearInsumo } from "../actions";

export default async function NuevoInsumoPage() {
  const [proveedores, zonasAlmacen, unidadesMedida, insumos] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    zonasAlmacenParaSelect(),
    unidadesMedidaParaSelect(),
    prisma.insumo.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/catalogo/insumos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a insumos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo insumo
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/catalogo/insumos/nuevo"
        nuevoTexto="Nuevo insumo"
        registros={insumos.map((i) => ({
          id: i.id,
          href: `/catalogo/insumos/${i.id}`,
          primario: i.nombre,
          secundario: i.codigo,
        }))}
      >
      <div className="max-w-lg">
        <InsumoFormulario
          accion={crearInsumo}
          proveedores={proveedores}
          zonasAlmacen={zonasAlmacen}
          unidadesMedida={unidadesMedida}
          textoBoton="Crear insumo"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
