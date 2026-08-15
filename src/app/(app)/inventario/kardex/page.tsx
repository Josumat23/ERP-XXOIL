import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ORIGEN } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";

// El kardex es historia inmutable: aquí solo se consulta, jamás se edita.
export default async function KardexPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; item?: string; almacenId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { tipo, item, almacenId } = await searchParams;
  const filtroTipo = tipo === "PRESENTACION" || tipo === "INSUMO" ? tipo : undefined;

  const [movimientos, presentaciones, insumos, almacenes] = await Promise.all([
    prisma.movimientoKardex.findMany({
      where: {
        ...(filtroTipo ? { tipoItem: filtroTipo } : {}),
        ...(item && filtroTipo === "PRESENTACION" ? { presentacionId: item } : {}),
        ...(item && filtroTipo === "INSUMO" ? { insumoId: item } : {}),
        ...(almacenId ? { almacenId } : {}),
      },
      include: { presentacion: { include: { producto: true } }, insumo: true, almacen: true },
      orderBy: { creadoEn: "desc" },
      take: 200,
    }),
    prisma.presentacion.findMany({ orderBy: { sku: "asc" } }),
    prisma.insumo.findMany({ orderBy: { codigo: "asc" } }),
    prisma.almacen.findMany({ orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Kardex</h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Historial de movimientos de inventario. Los registros nunca se editan ni se borran: las
        correcciones se hacen con ajustes que quedan auditados.
      </p>

      <form method="get" className="mt-5 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo de ítem</span>
          <select name="tipo" defaultValue={filtroTipo ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="PRESENTACION">Presentaciones</option>
            <option value="INSUMO">Insumos</option>
          </select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Ítem específico</span>
          <select
            name="item"
            defaultValue={item ?? ""}
            className="campo-input w-full min-w-0 sm:w-auto sm:min-w-56"
          >
            <option value="">Todos</option>
            <optgroup label="Presentaciones">
              {presentaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku}
                </option>
              ))}
            </optgroup>
            <optgroup label="Insumos">
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} — {i.nombre}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Almacén</span>
          <select name="almacenId" defaultValue={almacenId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton-secundario">
          Filtrar
        </button>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="tabla tabla-densa">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ítem</th>
              <th>Almacén</th>
              <th>Origen</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Saldo</th>
              <th>Referencia / Motivo</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => {
              const nombreItem =
                m.tipoItem === "PRESENTACION"
                  ? `${m.presentacion?.producto.nombre ?? ""} — ${m.presentacion?.nombre ?? ""}`
                  : m.insumo?.nombre ?? "";
              const esEntrada = m.tipoMovimiento === "ENTRADA";
              return (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs text-neutral-500">
                    {new Intl.DateTimeFormat("es-PE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(m.creadoEn)}
                  </td>
                  <td>
                    <span className="font-medium">{nombreItem}</span>
                    <span className="block text-xs text-neutral-400 font-mono">
                      {m.tipoItem === "PRESENTACION" ? m.presentacion?.sku : m.insumo?.codigo}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-500">{m.almacen.nombre}</td>
                  <td>
                    <span
                      className={`insignia ${
                        m.origen === "AJUSTE"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {ETIQUETA_ORIGEN[m.origen]}
                    </span>
                  </td>
                  <td
                    className={`text-right font-medium ${
                      esEntrada ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {esEntrada ? "+" : "−"}
                    {formatNumero(m.cantidad, 2)}
                  </td>
                  <td className="text-right">{formatNumero(m.saldoNuevo, 2)}</td>
                  <td className="text-sm text-neutral-500 max-w-64">
                    {m.motivo ?? m.referencia ?? "—"}
                  </td>
                  <td className="text-sm">{m.usuarioNombre}</td>
                </tr>
              );
            })}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-neutral-500 py-6">
                  Sin movimientos para el filtro seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
