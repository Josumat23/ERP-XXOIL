import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import ClienteFormulario from "../ClienteFormulario";
import { actualizarCliente } from "../actions";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cliente, zonas, vendedores, facturasPendientes] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.factura.findMany({ where: { clienteId: id, estado: "PENDIENTE" } }),
  ]);
  if (!cliente) notFound();

  const deudaActual = facturasPendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const limite = cliente.limiteCredito.toNumber();

  return (
    <div className="max-w-2xl">
      <Link href="/comercial/clientes" className="text-sm text-neutral-500 hover:underline">
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Ficha del cliente
      </h1>
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

      <div className="mt-6">
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
    </div>
  );
}
