import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_TIPO_VENDEDOR } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { alternarActivoVendedor } from "./actions";

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;

  const vendedores = await prisma.vendedor.findMany({
    where: {
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(q ? { nombre: { contains: q } } : {}),
    },
    include: { zona: true, _count: { select: { facturas: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Vendedores</h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Cada vendedor tiene su propia tasa de comisión; las comisiones se generan al facturar.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre...">
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
        nuevoHref="/comercial/vendedores/nuevo"
        nuevoTexto="Nuevo vendedor"
        registros={vendedores.map((v) => ({
          id: v.id,
          href: `/comercial/vendedores/${v.id}`,
          primario: v.nombre,
          secundario: ETIQUETA_TIPO_VENDEDOR[v.tipo],
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th className="text-right">Comisión</th>
            <th>Zona</th>
            <th>Facturas</th>
            <th>Estado</th>
            <th>Acciones</th>
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
      </PanelMaestroDetalle>
    </div>
  );
}
