import { redirect } from "next/navigation";
import { AccionAuditoriaMaestro, Prisma } from "@/generated/prisma/client";
import { obtenerUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACCIONES = Object.values(AccionAuditoriaMaestro);
const ETIQUETA_ACCION: Record<AccionAuditoriaMaestro, string> = {
  CREAR: "Creación",
  ACTUALIZAR: "Actualización",
  ACTIVAR: "Activación",
  DESACTIVAR: "Desactivación",
  ELIMINAR: "Eliminación",
};

function fechaValida(valor: string | undefined, finDelDia = false): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const fecha = new Date(`${valor}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

function formatearJson(valor: string | null): string {
  if (!valor) return "Sin datos";
  try {
    return JSON.stringify(JSON.parse(valor), null, 2);
  } catch {
    return valor;
  }
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; accion?: string; usuarioId?: string; desde?: string; hasta?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");

  const filtros = await searchParams;
  const entidad = filtros.entidad?.trim() || undefined;
  const usuarioId = filtros.usuarioId?.trim() || undefined;
  const accion = ACCIONES.find((valor) => valor === filtros.accion);
  const desde = fechaValida(filtros.desde);
  const hasta = fechaValida(filtros.hasta, true);
  const where: Prisma.AuditoriaMaestroWhereInput = {
    ...(entidad ? { entidad } : {}),
    ...(usuarioId ? { usuarioId } : {}),
    ...(accion ? { accion } : {}),
    ...(desde || hasta ? { creadoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
  };

  const [eventos, entidades, usuarios] = await Promise.all([
    prisma.auditoriaMaestro.findMany({ where, orderBy: { creadoEn: "desc" }, take: 200 }),
    prisma.auditoriaMaestro.findMany({ select: { entidad: true }, distinct: ["entidad"], orderBy: { entidad: "asc" } }),
    prisma.auditoriaMaestro.findMany({ select: { usuarioId: true, usuarioNombre: true }, distinct: ["usuarioId"], orderBy: { usuarioNombre: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold text-[var(--epicor-texto)]">Auditoría de datos maestros</h1>
      <p className="mt-1 text-sm text-[var(--epicor-texto-tenue)]">Historial inmutable de altas, cambios y bajas lógicas. Se muestran hasta 200 eventos recientes.</p>

      <form className="mt-6 grid gap-3 rounded-xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm"><span className="mb-1 block font-medium">Maestro</span><select name="entidad" defaultValue={entidad ?? ""} className="campo-input w-full"><option value="">Todos</option>{entidades.map((item) => <option key={item.entidad} value={item.entidad}>{item.entidad}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Acción</span><select name="accion" defaultValue={accion ?? ""} className="campo-input w-full"><option value="">Todas</option>{ACCIONES.map((item) => <option key={item} value={item}>{ETIQUETA_ACCION[item]}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Usuario</span><select name="usuarioId" defaultValue={usuarioId ?? ""} className="campo-input w-full"><option value="">Todos</option>{usuarios.map((item) => <option key={item.usuarioId} value={item.usuarioId}>{item.usuarioNombre}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Desde</span><input type="date" name="desde" defaultValue={filtros.desde ?? ""} className="campo-input w-full" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Hasta</span><input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className="campo-input w-full" /></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5"><button className="boton-primario" type="submit">Aplicar filtros</button><a className="boton-secundario" href="/configuracion/auditoria">Limpiar</a></div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="tabla"><thead><tr><th>Fecha</th><th>Maestro</th><th>Acción</th><th>Usuario</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>
          {eventos.map((evento) => (
            <tr key={evento.id}>
              <td className="whitespace-nowrap">{new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "medium" }).format(evento.creadoEn)}</td>
              <td>{evento.entidad}</td><td><span className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{ETIQUETA_ACCION[evento.accion]}</span></td>
              <td>{evento.usuarioNombre}</td><td className="font-mono text-xs">{evento.registroId}</td>
              <td><details className="min-w-72"><summary className="cursor-pointer text-[var(--epicor-azul)]">Comparar</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><div><p className="mb-1 text-xs font-semibold">Antes</p><pre className="max-h-72 overflow-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">{formatearJson(evento.valoresAntes)}</pre></div><div><p className="mb-1 text-xs font-semibold">Después</p><pre className="max-h-72 overflow-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">{formatearJson(evento.valoresDespues)}</pre></div></div></details></td>
            </tr>
          ))}
          {eventos.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[var(--epicor-texto-tenue)]">No hay eventos para los filtros seleccionados.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}