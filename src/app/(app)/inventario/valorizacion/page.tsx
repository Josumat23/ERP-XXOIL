import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { construirValorizacionInventario } from "@/lib/valorizacionInventario";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

export default async function ValorizacionInventarioPage({ searchParams }: { searchParams: Promise<{ corte?: string; almacenId?: string }> }) {
  const usuario = await obtenerUsuario(); if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const filtros = await searchParams; const fecha = filtros.corte ? crearFechaCalendarioLocal(filtros.corte) : new Date();
  if (!fecha) redirect("/inventario/valorizacion");
  const fin = new Date(fecha); fin.setHours(23, 59, 59, 999);
  const [movimientos, almacenes] = await Promise.all([
    prisma.movimientoKardex.findMany({ where: { empresaId: usuario.empresaId, fecha: { lte: fin }, ...(filtros.almacenId ? { almacenId: filtros.almacenId } : {}) }, include: { almacen: true, insumo: true, presentacion: { include: { producto: true } } }, orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }] }),
    prisma.almacen.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  const base = construirValorizacionInventario(movimientos.map((m) => ({ almacenId: m.almacenId, tipoItem: m.tipoItem, itemId: m.tipoItem === "INSUMO" ? m.insumoId! : m.presentacionId!, saldoNuevo: m.saldoNuevo.toNumber(), costoUnitario: m.costoUnitario.toNumber() })));
  const detalle = new Map(movimientos.map((m) => [`${m.almacenId}:${m.tipoItem}:${m.tipoItem === "INSUMO" ? m.insumoId : m.presentacionId}`, m]));
  return <div className="max-w-6xl"><div className="flex justify-between"><div><h1 className="text-2xl font-semibold">Valorización de inventario</h1><p className="text-neutral-500">Stock y valor contable al cierre del día seleccionado.</p></div><BotonImprimir/></div><form className="flex gap-3 items-end mt-5"><label className="text-sm">Fecha de corte<input name="corte" type="date" defaultValue={fin.toISOString().slice(0,10)} className="campo-input block" /></label><label className="text-sm">Almacén<select name="almacenId" defaultValue={filtros.almacenId ?? ""} className="campo-input block"><option value="">Todos</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label><button className="boton-secundario">Aplicar corte</button></form><div className="grid sm:grid-cols-2 gap-4 mt-6"><div className="border rounded-lg p-4"><span className="text-sm text-neutral-500">Valor total</span><strong className="block text-2xl">{formatMoneda(base.valorTotal)}</strong></div><div className="border rounded-lg p-4"><span className="text-sm text-neutral-500">Posiciones sin costo histórico</span><strong className="block text-2xl">{base.filasSinCosto}</strong></div></div>{base.filasSinCosto > 0 && <p className="mt-3 text-sm text-amber-700">Los movimientos anteriores a la implantación del snapshot de costo aparecen sin valor; no se sustituyen por costos actuales para evitar falsear el corte.</p>}<table className="tabla mt-6"><thead><tr><th>Almacén</th><th>Tipo</th><th>Artículo</th><th className="text-right">Cantidad</th><th className="text-right">Costo</th><th className="text-right">Valor</th></tr></thead><tbody>{base.filas.filter((f) => f.saldoNuevo !== 0).map((f) => { const m = detalle.get(`${f.almacenId}:${f.tipoItem}:${f.itemId}`)!; const nombre = f.tipoItem === "INSUMO" ? `${m.insumo?.codigo} — ${m.insumo?.nombre}` : `${m.presentacion?.sku} — ${m.presentacion?.producto.nombre}`; return <tr key={`${f.almacenId}:${f.tipoItem}:${f.itemId}`}><td>{m.almacen.nombre}</td><td>{f.tipoItem === "INSUMO" ? "Insumo" : "Producto"}</td><td>{nombre}</td><td className="text-right">{formatNumero(f.saldoNuevo,2)}</td><td className="text-right">{f.costoDisponible ? formatMoneda(f.costoUnitario) : "Sin snapshot"}</td><td className="text-right">{f.costoDisponible ? formatMoneda(f.valor) : "—"}</td></tr>; })}</tbody></table></div>;
}
