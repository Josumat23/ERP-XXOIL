import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { ETIQUETA_CONTROL, type ClaveControl } from "@/lib/contabilidad";
import { alternarActivoRegla } from "../actions";
import ControlCentroFormulario from "../ControlCentroFormulario";

export default async function ReglasAsignacionCostoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const [reglas, centros, controles] = await Promise.all([
    prisma.reglaAsignacionCosto.findMany({
      include: { lineas: { include: { centroCosto: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.centroCostoControl.findMany(),
  ]);

  const controlPorClave = new Map(
    controles.map((c) => [
      c.clave,
      c.reglaId ? `regla:${c.reglaId}` : c.centroCostoId ? `centro:${c.centroCostoId}` : "",
    ])
  );

  const centrosOpciones = centros.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }));
  const reglasOpciones = reglas
    .filter((r) => r.activo)
    .map((r) => ({ id: r.id, etiqueta: r.nombre }));
  const clavesControl = Object.entries(ETIQUETA_CONTROL) as [ClaveControl, string][];

  return (
    <div>
      <Link
        href="/finanzas/centros-costo"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a centros de costo
      </Link>

      <div className="flex items-center justify-between mt-1 mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Reglas y asignación de centros de costo
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Cada línea de asiento automático (clave de control) se etiqueta con un centro directo o
            se reparte proporcionalmente entre varios centros mediante una regla de prorrateo.
          </p>
        </div>
        <Link href="/finanzas/centros-costo/reglas/nueva" className="boton-primario">
          Nueva regla de prorrateo
        </Link>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Asignación por clave de control
        </h2>
        <div className="flex flex-col gap-2">
          {clavesControl.map(([clave, etiqueta]) => (
            <ControlCentroFormulario
              key={clave}
              clave={clave}
              etiqueta={etiqueta}
              valorActual={controlPorClave.get(clave) ?? ""}
              centros={centrosOpciones}
              reglas={reglasOpciones}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          Reglas de prorrateo existentes
        </h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Centros y porcentajes</th>
              <th>Estado</th>
              <th className="no-imprimir">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reglas.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td className="text-sm text-neutral-500">
                  {r.lineas
                    .map((l) => `${l.centroCosto.codigo} (${l.porcentaje.toNumber()}%)`)
                    .join(" · ")}
                </td>
                <td>
                  <span
                    className={`insignia ${
                      r.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {r.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="text-right no-imprimir">
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoRegla(r.id, !r.activo);
                    }}
                  >
                    <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      {r.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {reglas.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-neutral-500 py-6">
                  No hay reglas de prorrateo registradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
