"use client";

import { useRef } from "react";
import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";
import type { VerificacionCierre } from "@/lib/cierrePeriodo";

export type TareaVista = {
  id: string;
  orden: number;
  descripcion: string;
  completadaEn: string | null;
  completadaPorNombre: string | null;
  nota: string | null;
};

type Props = {
  mes: string;
  verificaciones: VerificacionCierre[];
  tareas: TareaVista[];
  periodoCerrado: boolean;
  agregarTarea: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  completarTarea: (
    tareaId: string,
    prevState: EstadoFormulario,
    formData: FormData
  ) => Promise<EstadoFormulario>;
};

function FormularioAgregar({
  accion,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) ref.current?.reset();
      return resultado;
    },
    {}
  );
  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-1 mt-2">
      {estado.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          name="descripcion"
          required
          maxLength={300}
          placeholder="Tarea de cierre (ej. conciliar bancos)"
          className="campo-input text-xs flex-1"
        />
        <button type="submit" disabled={enviando} className="boton-secundario text-xs shrink-0">
          {enviando ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </form>
  );
}

function FormularioCompletar({
  accion,
  bloqueada,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  bloqueada: boolean;
}) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      {estado.error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {estado.error}
        </span>
      )}
      <input
        name="nota"
        maxLength={300}
        placeholder="Nota (opcional)"
        className="campo-input text-xs w-44"
      />
      <button
        type="submit"
        disabled={enviando || bloqueada}
        title={bloqueada ? "Complete primero las tareas anteriores" : undefined}
        className="boton-secundario text-xs shrink-0 disabled:opacity-40"
      >
        {enviando ? "…" : "Marcar hecha"}
      </button>
    </form>
  );
}

export default function ChecklistCierre({
  mes,
  verificaciones,
  tareas,
  periodoCerrado,
  agregarTarea,
  completarTarea,
}: Props) {
  const pendientes =
    verificaciones.filter((v) => v.pendientes > 0).length +
    tareas.filter((t) => t.completadaEn === null).length;

  // La primera pendiente es la única que se puede completar: el cierre es una
  // secuencia.
  const primeraPendiente = tareas.find((t) => t.completadaEn === null);

  return (
    // <details> y no un useState: el contenido queda en el HTML aunque esté
    // plegado, así se puede imprimir y leer sin JavaScript, como el resto de
    // estas pantallas.
    <details className="text-sm">
      <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:underline text-xs">
        Checklist de {mes}
        {pendientes > 0 ? (
          <span className="ml-2 insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
            {pendientes} pendiente{pendientes === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="ml-2 insignia bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
            Sin pendientes
          </span>
        )}
      </summary>

      <div className="mt-2 pl-4 border-l border-black/10 dark:border-white/10 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Verificaciones automáticas
            </p>
            <ul className="flex flex-col gap-1 mt-1">
              {/* Se listan todas, superadas incluidas: quien firma un cierre
                  necesita ver qué se comprobó, no solo qué quedó pendiente. */}
              {verificaciones.map((v) => (
                <li key={v.clave} className="text-xs flex items-start gap-2">
                  <span className={v.pendientes > 0 ? "text-amber-600" : "text-green-600"}>
                    {v.pendientes > 0 ? "!" : "✓"}
                  </span>
                  <span className="flex-1">
                    <strong className="font-medium">{v.titulo}</strong>
                    {v.pendientes > 0 && (
                      <>
                        {" "}
                        — <a href={v.href} className="underline">
                          {v.pendientes} pendiente{v.pendientes === 1 ? "" : "s"}
                        </a>
                        <span className="block text-neutral-500">{v.detalle}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Tareas propias
            </p>
            {tareas.length === 0 ? (
              <p className="text-xs text-neutral-500 mt-1">
                Sin tareas definidas. El sistema no propone una lista: qué incluye el cierre lo
                define quien lleva los libros.
              </p>
            ) : (
              <ol className="flex flex-col gap-1 mt-1">
                {tareas.map((t) => (
                  <li key={t.id} className="text-xs flex items-start gap-2">
                    <span className={t.completadaEn ? "text-green-600" : "text-neutral-400"}>
                      {t.completadaEn ? "✓" : t.orden}
                    </span>
                    <span className="flex-1">
                      {t.descripcion}
                      {t.completadaEn && (
                        <span className="block text-neutral-500">
                          {t.completadaEn} · {t.completadaPorNombre}
                          {t.nota ? ` — ${t.nota}` : ""}
                        </span>
                      )}
                    </span>
                    {!t.completadaEn && !periodoCerrado && (
                      <FormularioCompletar
                        accion={completarTarea.bind(null, t.id)}
                        bloqueada={primeraPendiente?.id !== t.id}
                      />
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!periodoCerrado && <FormularioAgregar accion={agregarTarea} />}
        </div>
      </div>
    </details>
  );
}
