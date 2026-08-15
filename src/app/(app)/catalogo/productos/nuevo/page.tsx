import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProductoFormulario from "../ProductoFormulario";
import { crearProducto } from "../actions";

export default async function NuevoProductoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const [categorias, unidadesMedida, productos] = await Promise.all([
    prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    unidadesMedidaParaSelect(),
    prisma.producto.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/catalogo/productos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo producto
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/catalogo/productos/nuevo"
        nuevoTexto="Nuevo producto"
        registros={productos.map((p) => ({
          id: p.id,
          href: `/catalogo/productos/${p.id}`,
          primario: p.nombre,
          secundario: p.codigo,
        }))}
      >
      <div className="max-w-lg">
        <ProductoFormulario
          accion={crearProducto}
          categorias={categorias}
          unidadesMedida={unidadesMedida}
          textoBoton="Crear producto"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
