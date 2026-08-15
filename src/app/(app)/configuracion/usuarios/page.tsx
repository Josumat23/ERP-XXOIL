import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario, ETIQUETA_ROL } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import {
  CrearUsuarioFormulario,
  RestablecerPasswordFormulario,
  GrupoUsuarioFormulario,
} from "./UsuarioFormularios";
import { alternarActivoUsuario } from "./actions";

const DIAS_INACTIVIDAD_ALERTA = 90;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

export default async function UsuariosPage() {
  const actual = await obtenerUsuario();
  if (!actual || actual.rol !== "ADMIN") redirect("/");
  if (!(await puedeRealizar(actual, "configuracion", "ver"))) redirect("/");

  const [usuarios, grupos, sesiones] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { nombre: "asc" } }),
    prisma.grupoSeguridad.findMany({
      where: { esPredefinido: false, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    // Solo se necesita la conexión más reciente por usuario — un solo query
    // ordenado, se queda con la primera aparición de cada usuarioId.
    prisma.sesion.findMany({ orderBy: { creadoEn: "desc" }, select: { usuarioId: true, creadoEn: true } }),
  ]);

  const ultimaConexionPorUsuario = new Map<string, Date>();
  for (const s of sesiones) {
    if (!ultimaConexionPorUsuario.has(s.usuarioId)) ultimaConexionPorUsuario.set(s.usuarioId, s.creadoEn);
  }

  const hoy = new Date();
  function estadoAcceso(usuarioId: string, creadoEn: Date): { texto: string; alerta: boolean } {
    const ultima = ultimaConexionPorUsuario.get(usuarioId);
    if (!ultima) {
      const diasDesdeCreacion = (hoy.getTime() - creadoEn.getTime()) / MS_POR_DIA;
      return {
        texto: "Nunca inició sesión",
        alerta: diasDesdeCreacion > DIAS_INACTIVIDAD_ALERTA,
      };
    }
    const dias = Math.floor((hoy.getTime() - ultima.getTime()) / MS_POR_DIA);
    return {
      texto: new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(ultima),
      alerta: dias > DIAS_INACTIVIDAD_ALERTA,
    };
  }

  const cuentasARevisar = usuarios.filter((u) => u.activo && estadoAcceso(u.id, u.creadoEn).alerta).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Usuarios</h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Cuentas de acceso y roles. El rol define qué operaciones puede realizar cada persona.
      </p>
      {cuentasARevisar > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mb-4">
          ⚠ {cuentasARevisar} cuenta{cuentasARevisar === 1 ? "" : "s"} activa
          {cuentasARevisar === 1 ? "" : "s"} sin conexión hace más de {DIAS_INACTIVIDAD_ALERTA} días
          (o que nunca inició sesión) — revise si sigue siendo necesaria.
        </p>
      )}

      <PanelMaestroDetalle
        registros={usuarios.map((u) => ({
          id: u.id,
          href: `#usuario-${u.id}`,
          primario: u.nombre,
          secundario: u.usuario,
        }))}
      >
      <div className="max-w-4xl">
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nuevo usuario</h2>
        <CrearUsuarioFormulario grupos={grupos} />
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Grupo de seguridad</th>
            <th>Estado</th>
            <th>Última conexión</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => {
            const acceso = estadoAcceso(u.id, u.creadoEn);
            return (
            <tr key={u.id} id={`usuario-${u.id}`}>
              <td className="font-medium">{u.nombre}</td>
              <td className="font-mono text-xs">{u.usuario}</td>
              <td>{ETIQUETA_ROL[u.rol]}</td>
              <td>
                <GrupoUsuarioFormulario
                  usuarioId={u.id}
                  grupoActualId={u.grupoSeguridadId}
                  grupos={grupos}
                />
              </td>
              <td>
                <span
                  className={`insignia ${
                    u.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className={`text-sm ${acceso.alerta ? "text-amber-700 dark:text-amber-400" : "text-neutral-500"}`}>
                {acceso.texto}
                {acceso.alerta && " ⚠"}
              </td>
              <td>
                <div className="flex items-center gap-3 justify-end">
                  <RestablecerPasswordFormulario usuarioId={u.id} />
                  {u.id !== actual.id && (
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoUsuario(u.id, !u.activo);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-neutral-600 dark:text-neutral-400 hover:underline text-sm"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
