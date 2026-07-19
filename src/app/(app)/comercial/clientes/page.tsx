import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { alternarActivoCliente } from "./actions";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    include: { zona: true, _count: { select: { pedidos: true } } },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Clientes</h1>
          <p className="text-neutral-500 mt-1">Cartera de clientes de la empresa.</p>
        </div>
        <Link href="/comercial/clientes/nuevo" className="boton-primario">
          Nuevo cliente
        </Link>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Razón social</th>
            <th>RUC / DNI</th>
            <th>Zona</th>
            <th>Teléfono</th>
            <th>Pedidos</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.razonSocial}</td>
              <td className="font-mono text-xs">{c.ruc ?? "—"}</td>
              <td>{c.zona?.nombre ?? "—"}</td>
              <td>{c.telefono ?? "—"}</td>
              <td>{c._count.pedidos}</td>
              <td>
                <span
                  className={`insignia ${
                    c.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {c.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/comercial/clientes/${c.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Editar
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoCliente(c.id, !c.activo);
                    }}
                  >
                    <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      {c.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {clientes.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay clientes registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
