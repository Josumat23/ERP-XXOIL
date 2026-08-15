import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CategoriaFormulario from "../CategoriaFormulario";
import { actualizarCategoria } from "../actions";

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { id } = await params;

  const [categoria, categorias] = await Promise.all([
    prisma.categoria.findUnique({ where: { id } }),
    prisma.categoria.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  if (!categoria) notFound();

  return (
    <div>
      <Link href="/catalogo/categorias" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a categorías
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar categoría
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={categorias.map((c) => ({
          id: c.id,
          href: `/catalogo/categorias/${c.id}`,
          primario: c.nombre,
          secundario: c.descripcion ?? undefined,
        }))}
      >
      <div className="max-w-lg">
        <CategoriaFormulario
          accion={actualizarCategoria.bind(null, id)}
          valoresIniciales={{ nombre: categoria.nombre, descripcion: categoria.descripcion }}
          textoBoton="Guardar cambios"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
