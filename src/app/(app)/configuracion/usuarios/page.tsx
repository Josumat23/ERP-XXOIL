import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario, ETIQUETA_ROL } from "@/lib/auth";
import BotonImprimir from "@/components/BotonImprimir";
import {
  CrearUsuarioFormulario,
  RestablecerPasswordFormulario,
  GrupoUsuarioFormulario,
} from "./UsuarioFormularios";
import { alternarActivoUsuario } from "./actions";

export default async function UsuariosPage() {
  const actual = await obtenerUsuario();
  if (!actual || actual.rol !== "ADMIN") redirect("/");

  const usuarios = await prisma.usuario.findMany({ orderBy: { nombre: "asc" } });
  const grupos = await prisma.grupoSeguridad.findMany({
    where: { esPredefinido: false, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usuarios</h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Cuentas de acceso y roles. El rol define qué operaciones puede realizar cada persona.
      </p>

      <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
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
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
