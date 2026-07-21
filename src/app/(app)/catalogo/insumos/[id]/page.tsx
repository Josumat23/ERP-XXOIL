import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import InsumoFormulario from "../InsumoFormulario";
import { actualizarInsumo } from "../actions";

export default async function EditarInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [insumo, insumos, proveedores, zonasAlmacen, unidadesMedida] = await Promise.all([
    prisma.insumo.findUnique({ where: { id } }),
    prisma.insumo.findMany({ orderBy: { creadoEn: "desc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    zonasAlmacenParaSelect(),
    unidadesMedidaParaSelect(),
  ]);

  if (!insumo) notFound();

  return (
    <div>
      <Link href="/catalogo/insumos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a insumos
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar insumo
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
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
          accion={actualizarInsumo.bind(null, id)}
          proveedores={proveedores}
          zonasAlmacen={zonasAlmacen}
          unidadesMedida={unidadesMedida}
          valoresIniciales={{
            codigo: insumo.codigo,
            nombre: insumo.nombre,
            tipo: insumo.tipo,
            unidadMedida: insumo.unidadMedida,
            proveedorId: insumo.proveedorId,
            stock: insumo.stock.toNumber(),
            stockMinimo: insumo.stockMinimo.toNumber(),
            costoUnitario: insumo.costoUnitario.toNumber(),
            codigoProveedor: insumo.codigoProveedor,
            zonaAlmacenId: insumo.zonaAlmacenId,
            notas: insumo.notas,
            requiereInspeccion: insumo.requiereInspeccion,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
