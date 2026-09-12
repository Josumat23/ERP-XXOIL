import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha } from "@/lib/format";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { avanceCampana, ETIQUETA_DECISION } from "@/lib/certificacionAccesos";
import {
  AbrirCampanaFormulario,
  CerrarCampanaFormularios,
  DecisionFormulario,
} from "./CertificacionFormularios";

const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  COMPLETADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const COLOR_DECISION: Record<string, string> = {
  PENDIENTE: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800",
  CONFIRMADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  REVOCADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function CertificacionAccesosPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN" || !(await puedeRealizar(usuario, "configuracion", "ver"))) {
    redirect("/");
  }
  const puedeEditar = await puedeRealizar(usuario, "configuracion", "editar");

  const empresaId = await obtenerEmpresaActivaId();
  const campanas = await prisma.campanaCertificacionAccesos.findMany({
    where: { empresaId },
    include: { lineas: { orderBy: { usuarioLogin: "asc" } } },
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    take: 20,
  });
  const hayAbierta = campanas.some((c) => c.estado === "ABIERTA");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Certificación de accesos
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        Revisar y <strong>declarar por escrito</strong> que cada acceso sigue siendo correcto, con
        constancia de quién lo dijo y cuándo. Es distinto de la alerta de inactividad de{" "}
        <Link href="/configuracion/usuarios" className="text-[var(--epicor-azul)] hover:underline">
          Usuarios
        </Link>
        , que avisa pero no deja esa constancia. <strong>Nadie certifica su propio acceso.</strong>
      </p>

      {puedeEditar && <AbrirCampanaFormulario hayAbierta={hayAbierta} />}

      <div className="mt-6 flex flex-col gap-4">
        {campanas.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
            Todavía no se certificó ningún acceso.
          </p>
        )}

        {campanas.map((c) => {
          const avance = avanceCampana(c.lineas);
          return (
            <section key={c.id} className="borde-seccion">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                    {c.numero}{" "}
                    <span className="text-xs font-normal text-neutral-500">
                      {avance.confirmados} confirmados · {avance.revocados} revocados ·{" "}
                      {avance.pendientes} sin revisar
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Abierta por {c.abiertaPorNombre} el {formatFecha(c.creadoEn)}
                    {c.completadaPorNombre && ` · cerrada por ${c.completadaPorNombre}`}
                    {c.notas && ` · ${c.notas}`}
                  </p>
                </div>
                <span className={`insignia ${COLOR_ESTADO[c.estado]}`}>{c.estado}</span>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol / grupo</th>
                      <th>Puede</th>
                      <th>Último acceso</th>
                      <th>Decisión</th>
                      {c.estado === "ABIERTA" && puedeEditar && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {c.lineas.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.usuarioNombre}
                          <span className="ml-2 font-mono text-xs text-neutral-400">
                            {l.usuarioLogin}
                          </span>
                        </td>
                        <td className="text-xs">
                          {l.rol}
                          {l.grupoNombre && ` · ${l.grupoNombre}`}
                        </td>
                        <td className="text-xs">
                          {l.permisosResumen}
                          {l.conflictosSod && (
                            <span className="block text-red-600 dark:text-red-400">
                              {l.conflictosSod}
                            </span>
                          )}
                        </td>
                        <td className="text-xs">
                          {l.ultimoAccesoEn ? formatFecha(l.ultimoAccesoEn) : "Nunca"}
                        </td>
                        <td className="text-xs">
                          <span className={`insignia ${COLOR_DECISION[l.decision]}`}>
                            {ETIQUETA_DECISION[l.decision]}
                          </span>
                          {l.revisadoPorNombre && (
                            <span className="block text-neutral-500">
                              {l.revisadoPorNombre}
                              {l.motivo && ` — ${l.motivo}`}
                            </span>
                          )}
                        </td>
                        {c.estado === "ABIERTA" && puedeEditar && (
                          <td>
                            {l.decision === "PENDIENTE" ? (
                              <DecisionFormulario
                                lineaId={l.id}
                                esPropio={l.usuarioId === usuario.id}
                              />
                            ) : (
                              <span className="text-xs text-neutral-500">Revisado</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {c.estado === "ABIERTA" && puedeEditar && (
                <CerrarCampanaFormularios campanaId={c.id} pendientes={avance.pendientes} />
              )}
              {c.estado === "CANCELADA" && (
                <p className="mt-3 text-sm text-neutral-500">
                  <span className="font-medium">Cancelada:</span> {c.motivoCancelacion}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
