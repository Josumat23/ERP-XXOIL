import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ClienteFormulario from "../ClienteFormulario";
import { actualizarCliente } from "../actions";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cliente, clientes, zonas, vendedores, facturasPendientes] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.cliente.findMany({ orderBy: { razonSocial: "asc" } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.factura.findMany({ where: { clienteId: id, estado: "PENDIENTE" } }),
  ]);
  if (!cliente) notFound();

  const deudaActual = facturasPendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const limite = cliente.limiteCredito.toNumber();

  return (
    <div>
      <Link href="/comercial/clientes" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a clientes
      </Link>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          {cliente.razonSocial}
        </h1>
        <span className="font-mono text-xs text-neutral-400">{cliente.codigo}</span>
      </div>
      <p className="text-neutral-500 mt-1 text-sm">
        Deuda actual: <span className="font-medium">{formatMoneda(deudaActual)}</span>
        {limite > 0 && (
          <>
            {" "}
            · Límite de crédito: <span className="font-medium">{formatMoneda(limite)}</span> ·
            Disponible:{" "}
            <span
              className={`font-medium ${
                limite - deudaActual <= 0 ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {formatMoneda(Math.max(0, limite - deudaActual))}
            </span>
          </>
        )}
      </p>

      <div className="mt-4">
        <PanelMaestroDetalle
          seleccionadoId={id}
          nuevoHref="/comercial/clientes/nuevo"
          nuevoTexto="Nuevo cliente"
          registros={clientes.map((c) => ({
            id: c.id,
            href: `/comercial/clientes/${c.id}`,
            primario: c.razonSocial,
            secundario: c.codigo,
          }))}
        >
        <div className="max-w-2xl">
          <ClienteFormulario
            accion={actualizarCliente.bind(null, id)}
            zonas={zonas}
            vendedores={vendedores}
            valoresIniciales={{
              razonSocial: cliente.razonSocial,
              nombreComercial: cliente.nombreComercial,
              ruc: cliente.ruc,
              departamento: cliente.departamento,
              provincia: cliente.provincia,
              distrito: cliente.distrito,
              direccion: cliente.direccion,
              telefono: cliente.telefono,
              email: cliente.email,
              contactoNombre: cliente.contactoNombre,
              contactoTelefono: cliente.contactoTelefono,
              zonaId: cliente.zonaId,
              vendedorId: cliente.vendedorId,
              limiteCredito: cliente.limiteCredito.toNumber(),
              condicionPagoDefecto: cliente.condicionPagoDefecto,
              notas: cliente.notas,
            }}
            textoBoton="Guardar cambios"
          />
        </div>
        </PanelMaestroDetalle>
      </div>
    </div>
  );
}
