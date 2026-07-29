import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { MODULOS } from "./modulos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import GrupoFormulario from "./GrupoFormulario";
import PermisoCheckbox from "./PermisoCheckbox";
import { alternarActivoGrupo } from "./actions";

export default async function GruposSeguridadPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const grupos = await prisma.grupoSeguridad.findMany({
    include: { permisos: true },
    orderBy: [{ esPredefinido: "desc" }, { codigo: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Grupos de seguridad
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a Security Group Maintenance de Epicor. Los 4 roles del sistema
        (Administrador, Almacén, Producción, Ventas) aparecen como grupos predefinidos de solo
        lectura: el acceso a cada pantalla sigue controlado por el rol. Los grupos personalizados
        sí tienen efecto real: al asignarle uno a un usuario (en Configuración → Usuarios), sus
        casillas &quot;Crear&quot;/&quot;Editar&quot;/&quot;Aprobar&quot; por módulo restringen esas
        acciones para ese usuario, sin ampliar nunca lo que su rol ya permite. &quot;Aprobar&quot;
        cubre las autorizaciones de gerencia (órdenes de compra, pagos a proveedores, vacaciones):
        separado de &quot;Editar&quot; porque quien aprueba no debería ser la misma persona que crea
        o edita el registro (segregación de funciones).
      </p>

      <PanelMaestroDetalle
        registros={grupos.map((g) => ({
          id: g.id,
          href: `#grupo-${g.id}`,
          primario: g.nombre,
          secundario: g.esPredefinido ? "Predefinido" : g.codigo,
        }))}
      >
      <div className="max-w-4xl">
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Nuevo grupo personalizado
        </h2>
        <GrupoFormulario />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {grupos.map((g) => (
          <div key={g.id} id={`grupo-${g.id}`} className="border border-black/10 dark:border-white/10 rounded-lg p-4 scroll-mt-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {g.nombre} <span className="text-xs text-neutral-400 font-mono">{g.codigo}</span>
              </p>
              <div className="flex items-center gap-3">
                {g.esPredefinido && (
                  <span className="insignia bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                    Predefinido
                  </span>
                )}
                {!g.esPredefinido && (
                  <>
                    <span
                      className={`insignia ${
                        g.activo
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                      }`}
                    >
                      {g.activo ? "Activo" : "Inactivo"}
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoGrupo(g.id, !g.activo);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        {g.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>

            <table className="tabla mt-3">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th className="text-center">Ver</th>
                  <th className="text-center">Crear</th>
                  <th className="text-center">Editar</th>
                  <th className="text-center">Aprobar</th>
                </tr>
              </thead>
              <tbody>
                {MODULOS.map((m) => {
                  const permiso = g.permisos.find((p) => p.modulo === m.clave);
                  if (!permiso) return null;
                  return (
                    <tr key={m.clave}>
                      <td>{m.nombre}</td>
                      <td className="text-center">
                        <PermisoCheckbox
                          permisoId={permiso.id}
                          campo="puedeVer"
                          valorInicial={permiso.puedeVer}
                          disabled={g.esPredefinido}
                        />
                      </td>
                      <td className="text-center">
                        <PermisoCheckbox
                          permisoId={permiso.id}
                          campo="puedeCrear"
                          valorInicial={permiso.puedeCrear}
                          disabled={g.esPredefinido}
                        />
                      </td>
                      <td className="text-center">
                        <PermisoCheckbox
                          permisoId={permiso.id}
                          campo="puedeEditar"
                          valorInicial={permiso.puedeEditar}
                          disabled={g.esPredefinido}
                        />
                      </td>
                      <td className="text-center">
                        <PermisoCheckbox
                          permisoId={permiso.id}
                          campo="puedeAprobar"
                          valorInicial={permiso.puedeAprobar}
                          disabled={g.esPredefinido}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
