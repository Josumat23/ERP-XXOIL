import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ClienteFormulario from "../ClienteFormulario";
import { crearCliente } from "../actions";

export default async function NuevoClientePage() {
  const [zonas, vendedores, clientes] = await Promise.all([
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ orderBy: { razonSocial: "asc" } }),
  ]);

  return (
    <div>
      <Link href="/comercial/clientes" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo cliente
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/clientes/nuevo"
        nuevoTexto="Nuevo cliente"
        registros={clientes.map((c) => ({
          id: c.id,
          href: `/comercial/clientes/${c.id}`,
          primario: c.razonSocial,
          secundario: c.ruc ?? undefined,
        }))}
      >
      <div className="max-w-2xl">
        <ClienteFormulario
          accion={crearCliente}
          zonas={zonas}
          vendedores={vendedores}
          textoBoton="Crear cliente"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
