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
        <header
          className="h-8 shrink-0 flex items-center justify-end gap-3 px-3 text-[12px] no-imprimir border-b"
          style={{ background: "var(--epicor-panel)", borderColor: "var(--epicor-borde)" }}
        >
          <span className="font-medium">{usuario.nombre}</span>
          <span className="opacity-60">({ETIQUETA_ROL[usuario.rol]})</span>
          <form
            action={async () => {
              "use server";
              await cerrarSesion();
              redirect("/login");
            }}
          >
            <button type="submit" className="boton-secundario text-[11px] px-2 py-0.5">
              Cerrar sesión
            </button>
          </form>
        </header>
        <BarraPrograma />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
