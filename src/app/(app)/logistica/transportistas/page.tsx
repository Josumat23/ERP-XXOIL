import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  NuevoTransportistaFormulario,
  VehiculoFormulario,
  ConductorFormulario,
} from "./TransportistaFormularios";
import {
  alternarActivoConductor,
  alternarActivoTransportista,
  alternarActivoVehiculo,
} from "./actions";

export default async function TransportistasPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const puedeEditar = await puedeRealizar(usuario, "materiales", "editar");

  const empresaId = await obtenerEmpresaActivaId();
  const transportistas = await prisma.transportista.findMany({
    where: { empresaId },
    include: {
      vehiculos: { orderBy: { placa: "asc" } },
      conductores: { orderBy: { nombres: "asc" } },
      _count: { select: { guias: true } },
    },
    orderBy: [{ activo: "desc" }, { razonSocial: "asc" }],
  });

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Transportistas
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        Empresas de transporte contratadas, con sus vehículos y conductores. La guía de remisión los
        elige de aquí en vez de retipearlos. <strong>La flota propia no vive en este maestro</strong>:
        es Equipos, que además lleva su historial de mantenimiento.
      </p>

      {puedeEditar && <NuevoTransportistaFormulario />}

      <div className="mt-6 flex flex-col gap-4">
        {transportistas.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
            Todavía no hay transportistas registrados.
          </p>
        )}

        {transportistas.map((t) => (
          <section
            key={t.id}
            className={`borde-seccion ${t.activo ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                  {t.razonSocial}{" "}
                  <span className="font-mono text-xs text-neutral-400">{t.codigo}</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  {t.ruc ? `RUC ${t.ruc}` : "Sin RUC registrado"}
                  {t.registroMtc && ` · MTC ${t.registroMtc}`}
                  {t.telefono && ` · ${t.telefono}`}
                  {" · "}
                  {t._count.guias} {t._count.guias === 1 ? "guía" : "guías"}
                </p>
              </div>
              {puedeEditar && (
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoTransportista(t.id, !t.activo);
                  }}
                >
                  <button className="text-xs hover:underline text-[var(--epicor-texto-tenue)]">
                    {t.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Vehículos
                </h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {t.vehiculos.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2">
                      <span className={v.activo ? "" : "line-through text-neutral-400"}>
                        <span className="font-mono">{v.placa}</span>
                        {v.descripcion && (
                          <span className="text-neutral-500"> · {v.descripcion}</span>
                        )}
                      </span>
                      {puedeEditar && (
                        <form
                          action={async () => {
                            "use server";
                            await alternarActivoVehiculo(v.id, !v.activo);
                          }}
                        >
                          <button className="text-xs hover:underline text-[var(--epicor-texto-tenue)]">
                            {v.activo ? "Dar de baja" : "Reactivar"}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                  {t.vehiculos.length === 0 && (
                    <li className="text-xs text-neutral-500">Sin vehículos registrados.</li>
                  )}
                </ul>
                {puedeEditar && (
                  <div className="mt-3">
                    <VehiculoFormulario transportistaId={t.id} />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Conductores
                </h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {t.conductores.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className={c.activo ? "" : "line-through text-neutral-400"}>
                        {c.nombres} <span className="font-mono text-xs">{c.dni}</span>
                        {c.licencia && (
                          <span className="text-neutral-500"> · lic. {c.licencia}</span>
                        )}
                      </span>
                      {puedeEditar && (
                        <form
                          action={async () => {
                            "use server";
                            await alternarActivoConductor(c.id, !c.activo);
                          }}
                        >
                          <button className="text-xs hover:underline text-[var(--epicor-texto-tenue)]">
                            {c.activo ? "Dar de baja" : "Reactivar"}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                  {t.conductores.length === 0 && (
                    <li className="text-xs text-neutral-500">Sin conductores registrados.</li>
                  )}
                </ul>
                {puedeEditar && (
                  <div className="mt-3">
                    <ConductorFormulario transportistaId={t.id} />
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
