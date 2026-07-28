import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { alternarActivoInsumo } from "./actions";

const ETIQUETA_TIPO: Record<string, string> = {
  MATERIA_PRIMA: "Materia prima",
  ENVASE: "Envase",
  ETIQUETA: "Etiqueta",
};
const TIPOS = Object.keys(ETIQUETA_TIPO);

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string }>;
}) {
  const { q, tipo, estado } = await searchParams;
  const filtroTipo = TIPOS.find((t) => t === tipo);

  const insumos = await prisma.insumo.findMany({
    where: {
      ...(filtroTipo ? { tipo: filtroTipo as "MATERIA_PRIMA" | "ENVASE" | "ETIQUETA" } : {}),
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(q
        ? { OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }] }
        : {}),
    },
    include: { proveedor: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Insumos</h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Materia prima, envases y etiquetas usados en producción.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre o código...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select name="tipo" defaultValue={filtroTipo ?? ""} className="campo-input">
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
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
        nuevoHref="/catalogo/insumos/nuevo"
        nuevoTexto="Nuevo insumo"
        registros={insumos.map((i) => ({
          id: i.id,
          href: `/catalogo/insumos/${i.id}`,
          primario: i.nombre,
          secundario: i.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Proveedor</th>
            <th>Stock</th>
            <th>Costo unit.</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => {
            const bajoMinimo = i.stock.toNumber() < i.stockMinimo.toNumber();
            return (
              <tr key={i.id}>
                <td className="font-mono text-xs">{i.codigo}</td>
                <td>{i.nombre}</td>
                <td>{ETIQUETA_TIPO[i.tipo]}</td>
                <td>{i.proveedor?.razonSocial ?? "—"}</td>
                <td>
                  <span className={bajoMinimo ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                    {formatNumero(i.stock, 0)}
                  </span>{" "}
                  <span className="text-neutral-400">
                    {i.unidadMedida} / mín. {formatNumero(i.stockMinimo, 0)}
                  </span>
                </td>
                <td>{formatMoneda(i.costoUnitario, i.moneda)}</td>
                <td>
                  <span
                    className={`insignia ${
                      i.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {i.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/catalogo/insumos/${i.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoInsumo(i.id, !i.activo);
                      }}
                    >
                      <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                        {i.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {insumos.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay insumos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
