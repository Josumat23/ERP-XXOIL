import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import ProductoFormulario from "../ProductoFormulario";
import { crearProducto } from "../actions";

export default async function NuevoProductoPage() {
  const [categorias, unidadesMedida] = await Promise.all([
    prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    unidadesMedidaParaSelect(),
  ]);

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/productos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo producto
      </h1>

      <div className="mt-6">
        <ProductoFormulario
          accion={crearProducto}
          categorias={categorias}
          unidadesMedida={unidadesMedida}
          textoBoton="Crear producto"
        />
      </div>
    </div>
  );
}
