import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import TrasladoFormulario from "./TrasladoFormulario";
import ReubicarZonaFormulario from "./ReubicarZonaFormulario";
import MoverZonaFormulario, { type ItemConDistribucion } from "./MoverZonaFormulario";
import { distribucionZonas } from "@/lib/saldosZona";

export default async function TrasladosPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) {
    redirect("/inventario/kardex");
  }
  if (!(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const { almacenId } = await searchParams;

  const [presentaciones, insumos, almacenes, zonas, saldos, movimientos] = await Promise.all([
    prisma.presentacion.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      include: { producto: true, zonaAlmacen: { include: { almacen: true } } },
      orderBy: { sku: "asc" },
    }),
    prisma.insumo.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      include: { zonaAlmacen: { include: { almacen: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.almacen.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { codigo: "asc" } }),
    prisma.zonaAlmacen.findMany({
      where: { activo: true, almacen: { empresaId: usuario.empresaId } },
      include: { almacen: true },
      orderBy: [{ almacen: { codigo: "asc" } }, { codigo: "asc" }],
    }),
    prisma.saldoAlmacen.findMany({
      where: { almacen: { empresaId: usuario.empresaId }, cantidad: { gt: 0 }, ...(almacenId ? { almacenId } : {}) },
      include: {
        almacen: true,
        presentacion: { include: { producto: true } },
        insumo: true,
      },
      orderBy: { almacen: { codigo: "asc" } },
    }),
    prisma.movimientoKardex.findMany({
      where: { empresaId: usuario.empresaId, origen: "TRASLADO", tipoMovimiento: "SALIDA" },
      include: { presentacion: { include: { producto: true } }, insumo: true, almacen: true },
      orderBy: { creadoEn: "desc" },
      take: 30,
    }),
  ]);

  // Reparto por zona de cada ítem con stock, solo en almacenes que tengan
  // zonas: sin zonas no hay nada que repartir.
  const zonasPorAlmacen = new Map<string, typeof zonas>();
  for (const zona of zonas) {
    zonasPorAlmacen.set(zona.almacenId, [...(zonasPorAlmacen.get(zona.almacenId) ?? []), zona]);
  }
  const saldosZona = await prisma.saldoZona.findMany({
    where: { zona: { almacen: { empresaId: usuario.empresaId } } },
  });
  const itemsConDistribucion: ItemConDistribucion[] = saldos
    .filter((saldo) => zonasPorAlmacen.has(saldo.almacenId))
    .map((saldo) => {
      const itemId = saldo.presentacionId ?? saldo.insumoId ?? "";
      const propios = saldosZona.filter(
        (s) => s.itemId === itemId && zonasPorAlmacen.get(saldo.almacenId)?.some((z) => z.id === s.zonaAlmacenId)
      );
      const distribucion = distribucionZonas(
        saldo.cantidad.toNumber(),
        propios.map((s) => ({ zonaAlmacenId: s.zonaAlmacenId, cantidad: s.cantidad.toNumber() }))
      );
      const etiquetaItem = saldo.presentacion
        ? `${saldo.presentacion.sku} — ${saldo.presentacion.producto.nombre}`
        : `${saldo.insumo?.codigo} — ${saldo.insumo?.nombre}`;
      return {
        valor: `${saldo.tipoItem}:${itemId}`,
        etiqueta: `${etiquetaItem} · ${saldo.almacen.nombre}`,
        almacenId: saldo.almacenId,
        porZona: distribucion.porZona.map((z) => ({
          zonaAlmacenId: z.zonaAlmacenId,
          etiqueta: zonas.find((zona) => zona.id === z.zonaAlmacenId)?.codigo ?? z.zonaAlmacenId,
          cantidad: z.cantidad,
        })),
        sinZona: distribucion.sinZona,
        total: distribucion.total,
      };
    });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Traslados entre almacenes
      </h1>
      <p className="text-neutral-500 mt-1">
        Mueve stock de un almacén a otro: se registra una salida en el origen y una entrada en el
        destino con la misma referencia, dentro de una sola transacción. Si el almacén de origen no
        tiene suficiente stock, no se aplica ninguna de las dos.
      </p>

      {almacenes.length < 2 && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mt-4">
          Solo hay un almacén activo — los traslados sirven a partir de cuando registres un segundo
          almacén en Configuración → Almacenes.
        </p>
      )}

      <div className="mt-6">
        <TrasladoFormulario
          presentaciones={presentaciones.map((p) => ({
            valor: `PRESENTACION:${p.id}`,
            etiqueta: `${p.sku} — ${p.producto.nombre} ${p.nombre}`,
          }))}
          insumos={insumos.map((i) => ({
            valor: `INSUMO:${i.id}`,
            etiqueta: `${i.codigo} — ${i.nombre}`,
          }))}
          almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Repartir stock entre zonas del mismo almacén
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          Un mismo ítem puede tener cantidad en varias zonas a la vez. Repartirlo no mueve
          mercadería entre almacenes ni genera kardex: el saldo del almacén no cambia, solo se
          declara en qué estante está cada parte. Lo que todavía no se asignó figura como
          &quot;sin zona&quot;.
        </p>
        {itemsConDistribucion.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: "var(--epicor-texto-tenue)" }}>
            No hay ítems con stock en almacenes que tengan zonas registradas.
          </p>
        ) : (
          <div className="mt-4">
            <MoverZonaFormulario
              items={itemsConDistribucion}
              zonas={zonas.map((z) => ({
                id: z.id,
                almacenId: z.almacenId,
                etiqueta: `${z.codigo}${z.nombre ? ` — ${z.nombre}` : ""}`,
              }))}
            />
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Zona principal declarada del ítem
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          Etiqueta de ubicación declarada en la ficha del ítem. Desde que existe el reparto por
          zona, esta ya no es la verdad sobre dónde está el stock — sirve como zona de referencia
          para quien busca el ítem. La cantidad real por zona es la de arriba.
        </p>
        {zonas.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mt-4">
            No hay zonas de almacén registradas — cree al menos una en Configuración → Almacenes.
          </p>
        ) : (
          <div className="mt-4">
            <ReubicarZonaFormulario
              presentaciones={presentaciones.map((p) => ({
                valor: `PRESENTACION:${p.id}`,
                etiqueta: `${p.sku} — ${p.producto.nombre} ${p.nombre}`,
                zonaActual: p.zonaAlmacen ? `${p.zonaAlmacen.almacen.nombre} / ${p.zonaAlmacen.codigo}` : null,
              }))}
              insumos={insumos.map((i) => ({
                valor: `INSUMO:${i.id}`,
                etiqueta: `${i.codigo} — ${i.nombre}`,
                zonaActual: i.zonaAlmacen ? `${i.zonaAlmacen.almacen.nombre} / ${i.zonaAlmacen.codigo}` : null,
              }))}
              zonas={zonas.map((z) => ({
                id: z.id,
                almacenId: z.almacenId,
                etiqueta: `${z.almacen.nombre} / ${z.codigo}${z.nombre ? ` — ${z.nombre}` : ""}`,
              }))}
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Stock actual por almacén</h2>
          <form method="get" className="flex items-end gap-2 no-imprimir">
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
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="tabla tabla-densa">
            <thead>
              <tr>
                <th>Almacén</th>
                <th>Ítem</th>
                <th className="text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.id}>
                  <td>{s.almacen.nombre}</td>
                  <td>
                    {s.tipoItem === "PRESENTACION"
                      ? `${s.presentacion?.sku} — ${s.presentacion?.producto.nombre} ${s.presentacion?.nombre}`
                      : `${s.insumo?.codigo} — ${s.insumo?.nombre}`}
                  </td>
                  <td className="text-right">{formatNumero(s.cantidad, 2)}</td>
                </tr>
              ))}
              {saldos.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-500 py-4">
                    Sin saldos registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Traslados recientes</h2>
        <div className="overflow-x-auto mt-3">
          <table className="tabla tabla-densa">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Referencia</th>
                <th>Ítem</th>
                <th>Origen</th>
                <th className="text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs text-neutral-500">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                      m.creadoEn
                    )}
                  </td>
                  <td className="font-mono text-xs">{m.referencia}</td>
                  <td>
                    {m.tipoItem === "PRESENTACION"
                      ? `${m.presentacion?.producto.nombre} — ${m.presentacion?.nombre}`
                      : m.insumo?.nombre}
                  </td>
                  <td>{m.almacen.nombre}</td>
                  <td className="text-right">{formatNumero(m.cantidad, 2)}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin traslados registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
