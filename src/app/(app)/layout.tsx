import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { obtenerUsuario, cerrarSesion, ETIQUETA_ROL } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={usuario.rol} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-black/10 dark:border-white/10 flex items-center justify-end gap-4 px-6">
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
              {usuario.nombre}
            </p>
            <p className="text-xs text-neutral-500 leading-tight">{ETIQUETA_ROL[usuario.rol]}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await cerrarSesion();
              redirect("/login");
            }}
          >
            <button type="submit" className="boton-secundario text-xs px-3 py-1.5">
              Cerrar sesión
            </button>
          </form>
        </header>
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
