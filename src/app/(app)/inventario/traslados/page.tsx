import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatNumero } from "@/lib/format";
import TrasladoFormulario from "./TrasladoFormulario";

export default async function TrasladosPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) {
    redirect("/inventario/kardex");
  }

  const [presentaciones, insumos, almacenes, saldos, movimientos] = await Promise.all([
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.saldoAlmacen.findMany({
      where: { cantidad: { gt: 0 } },
      include: {
        almacen: true,
        presentacion: { include: { producto: true } },
        insumo: true,
      },
      orderBy: { almacen: { codigo: "asc" } },
    }),
    prisma.movimientoKardex.findMany({
      where: { origen: "TRASLADO", tipoMovimiento: "SALIDA" },
      include: { presentacion: { include: { producto: true } }, insumo: true, almacen: true },
      orderBy: { creadoEn: "desc" },
      take: 30,
    }),
  ]);

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

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Stock actual por almacén</h2>
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
