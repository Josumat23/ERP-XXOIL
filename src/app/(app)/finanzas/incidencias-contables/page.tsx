import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import BarraFiltro from "@/components/BarraFiltro";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { resolverIncidencia } from "./actions";
import ResolverFormulario from "./ResolverFormulario";

export default async function IncidenciasContablesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const { q, estado } = await searchParams;
  const filtroEstado = estado === "resueltas" ? "resueltas" : "abiertas";

  const incidencias = await prisma.incidenciaContable.findMany({
    where: {
      empresaId,
      resueltoEn: filtroEstado === "resueltas" ? { not: null } : null,
      ...(q ? { OR: [{ glosa: { contains: q } }, { referencia: { contains: q } }, { motivo: { contains: q } }] } : {}),
    },
    orderBy: { fecha: "desc" },
    take: 200,
  });

  const abiertas =
    filtroEstado === "abiertas"
      ? incidencias.length
      : await prisma.incidenciaContable.count({ where: { empresaId, resueltoEn: null } });

  const puedeResolver = await puedeRealizar(usuario, "finanzas", "editar");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Incidencias contables
          </h1>
          <p className="text-sm max-w-3xl" style={{ color: "var(--epicor-texto-tenue)" }}>
            Operaciones que se registraron bien pero <strong>no llegaron a generar su asiento</strong>.
            El motor contable no revierte la operación comercial cuando falta un control contable,
            el período está cerrado o el presupuesto se excede — el documento ya existe y anularlo
            sería peor. Lo que sí hace es dejar constancia aquí, para que el hueco se cierre a
            propósito y no se descubra al cuadrar libros.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      {abiertas > 0 && (
        <p className="text-sm mb-4 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 max-w-3xl">
          Hay <strong>{abiertas}</strong> {abiertas === 1 ? "operación sin asiento" : "operaciones sin asiento"}.
          Cada una necesita el asiento manual correspondiente, o que se configure lo que faltaba.
        </p>
      )}

      <BarraFiltro q={q} placeholder="Glosa, referencia o motivo...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado} className="campo-input">
            <option value="abiertas">Abiertas</option>
            <option value="resueltas">Resueltas</option>
          </select>
        </label>
      </BarraFiltro>

      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Origen</th>
              <th>Glosa</th>
              <th>Referencia</th>
              <th>Por qué no se posteó</th>
              <th>Registró</th>
              <th>{filtroEstado === "resueltas" ? "Resolución" : "Acción"}</th>
            </tr>
          </thead>
          <tbody>
            {incidencias.map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap">{formatFecha(i.fecha)}</td>
                <td className="font-mono text-xs">{i.origen}</td>
                <td className="font-medium">{i.glosa}</td>
                <td className="font-mono text-xs">{i.referencia ?? "—"}</td>
                <td className="text-amber-700 dark:text-amber-400">{i.motivo}</td>
                <td className="text-xs">{i.usuarioNombre}</td>
                <td>
                  {i.resueltoEn ? (
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">
                      {formatFecha(i.resueltoEn)} · {i.resueltoPorNombre}
                      {i.notaResolucion ? ` — ${i.notaResolucion}` : ""}
                    </span>
                  ) : puedeResolver ? (
                    <ResolverFormulario accion={resolverIncidencia} incidenciaId={i.id} />
                  ) : (
                    <span className="text-xs text-neutral-500">Sin permiso para resolver</span>
                  )}
                </td>
              </tr>
            ))}
            {incidencias.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-neutral-500 py-6">
                  {filtroEstado === "abiertas"
                    ? "Ninguna operación quedó sin asiento. Todo lo registrado llegó a la contabilidad."
                    : "No hay incidencias resueltas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
