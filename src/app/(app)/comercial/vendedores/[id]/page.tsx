import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ETIQUETA_TIPO_VENDEDOR } from "@/lib/etiquetas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import VendedorFormulario from "../VendedorFormulario";
import { actualizarVendedor } from "../actions";

export default async function EditarVendedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [vendedor, vendedores, zonas] = await Promise.all([
    prisma.vendedor.findUnique({ where: { id } }),
    prisma.vendedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!vendedor) notFound();

  return (
    <div>
      <Link href="/comercial/vendedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a vendedores
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Editar vendedor
      </h1>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        La tasa nueva solo aplica a facturas futuras; las comisiones ya generadas conservan su tasa.
      </p>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/comercial/vendedores/nuevo"
        nuevoTexto="Nuevo vendedor"
        registros={vendedores.map((v) => ({
          id: v.id,
          href: `/comercial/vendedores/${v.id}`,
          primario: v.nombre,
          secundario: ETIQUETA_TIPO_VENDEDOR[v.tipo],
        }))}
      >
      <div className="max-w-lg">
        <VendedorFormulario
          accion={actualizarVendedor.bind(null, id)}
          zonas={zonas}
          valoresIniciales={{
            nombre: vendedor.nombre,
            documento: vendedor.documento,
            telefono: vendedor.telefono,
            email: vendedor.email,
            tipo: vendedor.tipo,
            tasaComision: vendedor.tasaComision.toNumber(),
            zonaId: vendedor.zonaId,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
