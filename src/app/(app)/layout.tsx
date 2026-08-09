import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BarraPrograma from "@/components/BarraPrograma";
import { obtenerUsuario, cerrarSesion, ETIQUETA_ROL } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <a href="#contenido-principal" className="saltar-contenido no-imprimir">
        Saltar al contenido principal
      </a>
      <Sidebar rol={usuario.rol} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0">
            <BarraPrograma />
          </div>
          <header className="h-12 shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 text-sm no-imprimir border-b border-l border-[var(--epicor-borde)] bg-[var(--epicor-panel)]">
            <div className="text-right leading-tight hidden sm:block min-w-0">
              <p className="font-semibold text-[var(--epicor-texto)] truncate max-w-[38vw] sm:max-w-[160px]">{usuario.nombre}</p>
              <p className="text-[11px] text-[var(--epicor-texto-tenue)]">{ETIQUETA_ROL[usuario.rol]}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await cerrarSesion();
                redirect("/login");
              }}
            >
              <button type="submit" className="boton-secundario text-[12px] px-2.5 sm:px-3 py-1.5 whitespace-nowrap">
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </form>
          </header>
        </div>
        <main id="contenido-principal" tabIndex={-1} className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
