"use client";

import { useActionState } from "react";
import { agregarCuentaBancaria, eliminarCuentaBancaria, type EstadoFormulario } from "./actions";

type Cuenta = { id: string; banco: string; moneda: string; numeroCuenta: string; cci: string | null };

export default function CuentasBancarias({ cuentas }: { cuentas: Cuenta[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    agregarCuentaBancaria,
    {}
  );

  return (
    <fieldset className="borde-seccion">
      <legend className="titulo-seccion">Cuentas bancarias (pie de Factura / Nota de Crédito)</legend>
      <p className="text-xs text-neutral-500 mb-3">
        Aparecen en la representación impresa como &quot;Sírvase abonar en nuestras cuentas&quot;.
      </p>

      <table className="tabla mb-3">
        <thead>
          <tr>
            <th>Banco</th>
            <th>Moneda</th>
            <th>Cuenta</th>
            <th>CCI</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => (
            <tr key={c.id}>
              <td>{c.banco}</td>
              <td>{c.moneda}</td>
              <td className="font-mono text-xs">{c.numeroCuenta}</td>
              <td className="font-mono text-xs">{c.cci ?? "—"}</td>
              <td className="text-right">
                <form action={eliminarCuentaBancaria.bind(null, c.id)}>
                  <button type="submit" className="text-xs text-neutral-400 hover:text-red-500">
                    Eliminar
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {cuentas.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-3">
                Sin cuentas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form action={formAction} className="flex flex-wrap gap-2 items-end">
        {estado.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 basis-full">{estado.error}</p>}
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[160px]">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Banco</span>
          <input name="banco" required placeholder="BBVA" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Moneda</span>
          <select name="moneda" defaultValue="PEN" className="campo-input">
            <option value="PEN">Soles</option>
            <option value="USD">Dólares</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[180px]">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">N° de cuenta</span>
          <input name="numeroCuenta" required className="campo-input font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">CCI (opcional)</span>
          <input name="cci" className="campo-input font-mono" />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Agregando..." : "+ Agregar cuenta"}
        </button>
      </form>
    </fieldset>
  );
}
