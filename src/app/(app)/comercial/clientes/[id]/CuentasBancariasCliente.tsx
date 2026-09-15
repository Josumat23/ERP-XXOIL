"use client";

import { useActionState, useState } from "react";
import {
  ETIQUETA_TIPO_CUENTA,
  MONEDAS_CUENTA,
  numeroParcial,
  type TipoCuentaBancaria,
} from "@/lib/cuentasBancariasCliente";
import {
  actualizarCuentaBancaria,
  crearCuentaBancaria,
  desactivarCuentaBancaria,
  type EstadoFormulario,
} from "./cuentasActions";

export type CuentaVista = {
  id: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  cci: string | null;
  moneda: string;
  titular: string | null;
  esPrincipal: boolean | null;
  activa: boolean;
  notas: string | null;
};

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}

function Formulario({
  cuenta,
  accion,
  textoBoton,
  onListo,
}: {
  cuenta?: CuentaVista;
  accion: (prev: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  textoBoton: string;
  onListo: () => void;
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, datos) => {
      const resultado = await accion(prev, datos);
      if (!resultado.error) onListo();
      return resultado;
    },
    {}
  );

  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Banco *">
        <input
          name="banco"
          required
          maxLength={80}
          defaultValue={cuenta?.banco ?? ""}
          className="campo-input"
          placeholder="BCP, BBVA, Interbank..."
        />
      </Campo>
      <Campo etiqueta="Tipo de cuenta">
        <select
          name="tipoCuenta"
          defaultValue={cuenta?.tipoCuenta ?? "CORRIENTE"}
          className="campo-input"
        >
          {(["CORRIENTE", "AHORROS"] as TipoCuentaBancaria[]).map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_CUENTA[t]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Número de cuenta *">
        <input
          name="numeroCuenta"
          required
          maxLength={40}
          defaultValue={cuenta?.numeroCuenta ?? ""}
          className="campo-input font-mono"
        />
      </Campo>
      <Campo etiqueta="CCI (20 dígitos)">
        <input
          name="cci"
          maxLength={30}
          defaultValue={cuenta?.cci ?? ""}
          className="campo-input font-mono"
          placeholder="Para transferir entre bancos distintos"
        />
      </Campo>

      <Campo etiqueta="Moneda">
        <select name="moneda" defaultValue={cuenta?.moneda ?? "PEN"} className="campo-input">
          {MONEDAS_CUENTA.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Titular">
        <input
          name="titular"
          maxLength={160}
          defaultValue={cuenta?.titular ?? ""}
          className="campo-input"
          placeholder="Si difiere de la razón social"
        />
      </Campo>

      <div className="sm:col-span-2">
        <Campo etiqueta="Notas">
          <input
            name="notas"
            maxLength={300}
            defaultValue={cuenta?.notas ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="principal"
            defaultChecked={cuenta ? cuenta.esPrincipal === true : false}
          />
          <span>Cuenta principal</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activa" value="on" defaultChecked={cuenta?.activa ?? true} />
          <span>Activa</span>
        </label>
      </div>

      {estado.error && (
        <p role="alert" className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : textoBoton}
        </button>
        <button type="button" onClick={onListo} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BotonDesactivar({ cuentaId }: { cuentaId: string }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async () => desactivarCuentaBancaria(cuentaId),
    {}
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={enviando}
        className="text-xs text-red-700 hover:underline dark:text-red-400"
        title="Deja de proponerse; los cobros ya hechos conservan la cuenta que usaron"
      >
        {enviando ? "Desactivando..." : "Desactivar"}
      </button>
      {estado.error && (
        <span role="alert" className="ml-2 text-xs text-red-600">
          {estado.error}
        </span>
      )}
    </form>
  );
}

export default function CuentasBancariasCliente({
  clienteId,
  cuentas,
  puedeEditar,
}: {
  clienteId: string;
  cuentas: CuentaVista[];
  puedeEditar: boolean;
}) {
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <section className="borde-seccion">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="titulo-seccion">Cuentas bancarias</h2>
          <p className="text-xs text-neutral-500">
            Dato restringido: solo lo ve y lo edita quien tiene permiso de Finanzas.
          </p>
        </div>
        {puedeEditar && !agregando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="boton-secundario text-sm"
          >
            Agregar cuenta
          </button>
        )}
      </div>

      {agregando && (
        <div className="mt-3 rounded-lg border border-[var(--epicor-borde)] p-3">
          <h3 className="text-sm font-medium">Nueva cuenta</h3>
          <Formulario
            accion={crearCuentaBancaria.bind(null, clienteId)}
            textoBoton="Agregar"
            onListo={() => setAgregando(false)}
          />
        </div>
      )}

      {cuentas.length === 0 && !agregando && (
        <p className="mt-3 text-sm text-neutral-500">
          Este cliente no tiene cuentas bancarias registradas.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {cuentas.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${
              c.activa
                ? "border-[var(--epicor-borde)]"
                : "border-dashed border-neutral-300 opacity-60 dark:border-neutral-700"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {c.banco}
                </span>
                <span className="ml-2 text-xs text-neutral-500">
                  {ETIQUETA_TIPO_CUENTA[c.tipoCuenta as TipoCuentaBancaria]} · {c.moneda}
                </span>
                {c.esPrincipal === true && (
                  <span className="ml-2 insignia bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400">
                    Principal
                  </span>
                )}
                {!c.activa && <span className="ml-2 text-xs text-neutral-500">Inactiva</span>}
              </div>
              {puedeEditar && c.activa && editandoId !== c.id && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditandoId(c.id)}
                    className="text-xs text-[var(--epicor-azul)] hover:underline"
                  >
                    Editar
                  </button>
                  <BotonDesactivar cuentaId={c.id} />
                </div>
              )}
            </div>

            {/* Solo el final del número: quien necesita el completo lo ve al
                editar, y así no queda a la vista de cualquiera que pase. */}
            <p className="mt-1 font-mono text-sm text-neutral-700 dark:text-neutral-300">
              {numeroParcial(c.numeroCuenta)}
              {c.cci && (
                <span className="ml-3 text-xs text-neutral-500">
                  CCI {numeroParcial(c.cci)}
                </span>
              )}
            </p>
            {c.titular && (
              <p className="text-xs text-neutral-500">A nombre de {c.titular}</p>
            )}
            {c.notas && <p className="text-xs text-neutral-500">{c.notas}</p>}

            {editandoId === c.id && (
              <Formulario
                cuenta={c}
                accion={actualizarCuentaBancaria.bind(null, c.id)}
                textoBoton="Guardar cambios"
                onListo={() => setEditandoId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
