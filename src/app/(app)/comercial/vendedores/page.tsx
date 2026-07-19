import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_TIPO_VENDEDOR } from "@/lib/etiquetas";
import { alternarActivoVendedor } from "./actions";

export default async function VendedoresPage() {
  const vendedores = await prisma.vendedor.findMany({
    include: { zona: true, _count: { select: { facturas: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Vendedores</h1>
          <p className="text-neutral-500 mt-1">
            Cada vendedor tiene su propia tasa de comisión; las comisiones se generan al facturar.
          </p>
        </div>
        <Link href="/comercial/vendedores/nuevo" className="boton-primario">
          Nuevo vendedor
        </Link>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th className="text-right">Comisión</th>
            <th>Zona</th>
            <th>Facturas</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vendedores.map((v) => (
            <tr key={v.id}>
              <td className="font-medium">{v.nombre}</td>
              <td>{ETIQUETA_TIPO_VENDEDOR[v.tipo]}</td>
              <td className="text-right">{formatNumero(v.tasaComision, 1)}%</td>
              <td>{v.zona?.nombre ?? "—"}</td>
              <td>{v._count.facturas}</td>
              <td>
                <span
                  className={`insignia ${
                    v.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {v.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/comercial/vendedores/${v.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Editar
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoVendedor(v.id, !v.activo);
                    }}
                  >
                    <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      {v.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {vendedores.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay vendedores registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
