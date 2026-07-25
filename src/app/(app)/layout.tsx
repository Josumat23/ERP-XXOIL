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
      <Sidebar rol={usuario.rol} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0">
            <BarraPrograma />
          </div>
          <header className="h-12 shrink-0 flex items-center gap-3 px-4 text-sm no-imprimir border-b border-l border-[var(--epicor-borde)] bg-[var(--epicor-panel)]">
            <div className="text-right leading-tight">
              <p className="font-semibold text-[var(--epicor-texto)]">{usuario.nombre}</p>
              <p className="text-[11px] text-[var(--epicor-texto-tenue)]">{ETIQUETA_ROL[usuario.rol]}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await cerrarSesion();
                redirect("/login");
              }}
            >
              <button type="submit" className="boton-secundario text-[12px] px-3 py-1.5">
                Cerrar sesión
              </button>
            </form>
          </header>
        </div>
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
