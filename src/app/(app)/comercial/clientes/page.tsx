import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { alternarActivoCliente } from "./actions";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    include: {
      zona: true,
      vendedorAsignado: true,
      _count: { select: { pedidos: true } },
      facturas: { where: { estado: "PENDIENTE" }, select: { saldo: true } },
    },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Clientes</h1>
          <p className="text-neutral-500 mt-1 no-imprimir">Cartera de clientes de la empresa.</p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
          <Link href="/comercial/clientes/nuevo" className="boton-primario">
            Nuevo cliente
          </Link>
        </div>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Razón social</th>
            <th>RUC / DNI</th>
            <th>Ubicación</th>
            <th>Zona</th>
            <th>Vendedor</th>
            <th className="text-right">Deuda</th>
            <th className="text-right">Límite créd.</th>
            <th>Estado</th>
            <th className="no-imprimir"></th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => {
            const deuda = c.facturas.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
            const limite = c.limiteCredito.toNumber();
            const excedido = limite > 0 && deuda >= limite;
            return (
              <tr key={c.id}>
                <td>
                  <span className="font-medium">{c.razonSocial}</span>
                  {c.nombreComercial && (
                    <span className="block text-xs text-neutral-400">{c.nombreComercial}</span>
                  )}
                </td>
                <td className="font-mono text-xs">{c.ruc ?? "—"}</td>
                <td className="text-sm text-neutral-500">
                  {[c.distrito, c.departamento].filter(Boolean).join(", ") || "—"}
                </td>
                <td>{c.zona?.nombre ?? "—"}</td>
                <td className="text-sm">{c.vendedorAsignado?.nombre ?? "—"}</td>
                <td
                  className={`text-right ${
                    excedido ? "text-red-600 dark:text-red-400 font-medium" : ""
                  }`}
                >
                  {formatMoneda(deuda)}
                </td>
                <td className="text-right text-neutral-500">
                  {limite > 0 ? formatMoneda(limite) : "Sin límite"}
                </td>
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
                <td className="text-right no-imprimir">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/comercial/clientes/${c.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Ficha
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
            );
          })}
          {clientes.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay clientes registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
