import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { ETIQUETA_CONTROL, type ClaveControl } from "@/lib/contabilidad";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { CuentaFormulario, ControlFormulario } from "./PlanCuentasFormularios";
import { alternarActivoCuenta } from "./actions";

const ETIQUETA_TIPO: Record<string, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  INGRESO: "Ingreso",
  GASTO: "Gasto",
};

const COLOR_TIPO: Record<string, string> = {
  ACTIVO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  PASIVO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PATRIMONIO: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400",
  INGRESO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  GASTO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function PlanCuentasPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const [cuentas, controles] = await Promise.all([
    prisma.cuentaContable.findMany({ orderBy: { codigo: "asc" } }),
    prisma.controlContable.findMany(),
  ]);

  const controlPorClave = new Map(controles.map((c) => [c.clave, c.cuentaId]));
  const cuentasParaSelect = cuentas
    .filter((c) => c.activo)
    .map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }));

  const clavesControl = Object.entries(ETIQUETA_CONTROL) as [ClaveControl, string][];
  const faltantes = clavesControl.filter(([clave]) => !controlPorClave.has(clave));

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Plan de cuentas
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a Chart of Accounts + GL Controls de Epicor. Las cuentas siguen la
        codificación del PCGE peruano; los controles indican qué cuenta usa cada asiento automático.
      </p>

      <PanelMaestroDetalle
        registros={cuentas.map((c) => ({
          id: c.id,
          href: `#cuenta-${c.id}`,
          primario: c.nombre,
          secundario: c.codigo,
        }))}
      >
      <div className="max-w-4xl">

      {faltantes.length > 0 && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
          ⚠ Hay {faltantes.length} control(es) contable(s) sin cuenta asignada. Las transacciones
          operativas funcionan igual, pero no generan asiento hasta completar la configuración.
        </p>
      )}

      <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva cuenta</h2>
        <CuentaFormulario />
      </div>

      <section className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
          Controles contables (cuentas de los asientos automáticos)
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          Venta: CxC / Ventas + IGV · Costo: Costo de ventas / Inventario PT · Cobro: Caja / CxC ·
          Compra: Inventario insumos / CxP · Pago: CxP / Caja · NC: Devoluciones + IGV / CxC
        </p>
        <div className="flex flex-col gap-2">
          {clavesControl.map(([clave, etiqueta]) => (
            <ControlFormulario
              key={clave}
              clave={clave}
              etiqueta={etiqueta}
              cuentaActualId={controlPorClave.get(clave) ?? null}
              cuentas={cuentasParaSelect}
            />
          ))}
        </div>
      </section>

      <table className="tabla tabla-densa mt-6">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cuenta</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => (
            <tr key={c.id} id={`cuenta-${c.id}`}>
              <td className="font-mono text-xs">{c.codigo}</td>
              <td>{c.nombre}</td>
              <td>
                <span className={`insignia ${COLOR_TIPO[c.tipo]}`}>{ETIQUETA_TIPO[c.tipo]}</span>
              </td>
              <td>
                <span
                  className={`insignia ${
                    c.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {c.activo ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-right">
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoCuenta(c.id, !c.activo);
                  }}
                >
                  <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {cuentas.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                No hay cuentas registradas todavía. El seed crea el plan base.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
