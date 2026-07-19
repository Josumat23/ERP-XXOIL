import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import { alternarActivoPresentacion } from "./actions";

export default async function PresentacionesPage() {
  const presentaciones = await prisma.presentacion.findMany({
    include: { producto: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Presentaciones
          </h1>
          <p className="text-neutral-500 mt-1">
            SKUs de venta por producto (pote, balde, cilindro, etc.).
          </p>
        </div>
        <Link href="/catalogo/presentaciones/nuevo" className="boton-primario">
          Nueva presentación
        </Link>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Contenido</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {presentaciones.map((p) => {
            const bajoMinimo = p.stock.toNumber() < p.stockMinimo.toNumber();
            return (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.sku}</td>
                <td>{p.producto.nombre}</td>
                <td>{p.nombre}</td>
                <td>{formatNumero(p.contenidoKg, 3)} kg</td>
                <td>{formatMoneda(p.precio, p.moneda)}</td>
                <td>
                  <span className={bajoMinimo ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                    {formatNumero(p.stock, 0)}
                  </span>
                  <span className="text-neutral-400"> / mín. {formatNumero(p.stockMinimo, 0)}</span>
                </td>
                <td>
                  <span
                    className={`insignia ${
                      p.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/catalogo/presentaciones/${p.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoPresentacion(p.id, !p.activo);
                      }}
                    >
                      <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                        {p.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {presentaciones.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay presentaciones registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
