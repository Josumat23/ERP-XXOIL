import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { asegurarEmpresaPrincipal, obtenerEmpresaActivaId } from "@/lib/empresas";
import { crearEmpresa, alternarActivaEmpresa, cambiarEmpresaActiva } from "./actions";
import EmpresaFormulario from "./EmpresaFormulario";

export default async function EmpresasPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  await asegurarEmpresaPrincipal();

  const [empresas, empresaActivaId] = await Promise.all([
    prisma.empresa.findMany({ orderBy: [{ esPrincipal: "desc" }, { creadoEn: "asc" }] }),
    obtenerEmpresaActivaId(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Compañías
      </h1>
      <p className="text-sm mb-1" style={{ color: "var(--epicor-texto-tenue)" }}>
        Base para operar más de una compañía real (ej. una subsidiaria en otro país). La compañía
        activa determina qué clientes y proveedores ves y creas en tu sesión.
      </p>
      <p className="text-xs mb-6 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 max-w-2xl">
        Alcance actual (fase 1): Clientes y Proveedores ya filtran de verdad por compañía. El resto
        del sistema (insumos, pedidos, facturas, órdenes de compra, asientos contables, tasas de
        Configuración → Empresa) todavía opera solo contra la compañía principal — extenderlo a
        todo el sistema es una fase 2 más grande, para no arriesgar mezclar datos financieros de
        compañías distintas sin poder probarlo primero.
      </p>

      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 max-w-lg">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva compañía</h2>
        <EmpresaFormulario accion={crearEmpresa} />
      </div>

      <table className="tabla mt-6 max-w-2xl">
        <thead>
          <tr>
            <th>Razón social</th>
            <th>País</th>
            <th>Moneda</th>
            <th>Estado</th>
            <th className="no-imprimir">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {empresas.map((e) => (
            <tr key={e.id}>
              <td>
                {e.razonSocial}
                {e.id === empresaActivaId && (
                  <span className="insignia ml-2 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
                    Activa
                  </span>
                )}
                {e.esPrincipal && (
                  <span className="insignia ml-2 bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                    Principal
                  </span>
                )}
              </td>
              <td>{e.pais}</td>
              <td className="font-mono text-xs">{e.monedaFuncional}</td>
              <td>
                <span
                  className={`insignia ${
                    e.activa
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {e.activa ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-right no-imprimir">
                <div className="flex items-center gap-3 justify-end">
                  {e.id !== empresaActivaId && (
                    <form
                      action={async () => {
                        "use server";
                        await cambiarEmpresaActiva(e.id);
                      }}
                    >
                      <button type="submit" className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline">
                        Usar esta compañía
                      </button>
                    </form>
                  )}
                  {!e.esPrincipal && (
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivaEmpresa(e.id, !e.activa);
                      }}
                    >
                      <button type="submit" className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline">
                        {e.activa ? "Desactivar" : "Activar"}
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
