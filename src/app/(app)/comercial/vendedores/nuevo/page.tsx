import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { ETIQUETA_TIPO_VENDEDOR } from "@/lib/etiquetas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import VendedorFormulario from "../VendedorFormulario";
import { crearVendedor } from "../actions";

export default async function NuevoVendedorPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const [zonas, vendedores] = await Promise.all([
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vendedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div>
      <Link href="/comercial/vendedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a vendedores
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo vendedor
      </h1>

      <PanelMaestroDetalle
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
        <VendedorFormulario accion={crearVendedor} zonas={zonas} textoBoton="Crear vendedor" />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
