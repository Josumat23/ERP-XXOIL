import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { alternarActivoPresentacion } from "./actions";

export default async function PresentacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { q, estado } = await searchParams;

  const presentaciones = await prisma.presentacion.findMany({
    where: {
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q } },
              { sku: { contains: q } },
              { producto: { nombre: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { producto: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Presentaciones
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            SKUs de venta por producto (pote, balde, cilindro, etc.).
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="SKU, nombre o producto...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/catalogo/presentaciones/nuevo"
        nuevoTexto="Nueva presentación"
        registros={presentaciones.map((p) => ({
          id: p.id,
          href: `/catalogo/presentaciones/${p.id}`,
          primario: p.nombre,
          secundario: `${p.sku} · ${p.producto.nombre}`,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Contenido</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Acciones</th>
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
                  {p.stockReservado.toNumber() > 0 && (
                    <span className="block text-xs text-amber-700 dark:text-amber-400">
                      {formatNumero(p.stockReservado, 0)} reservado en pedidos pendientes
                    </span>
                  )}
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
      </PanelMaestroDetalle>
    </div>
  );
}
