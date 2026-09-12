import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { arbolUbigeos } from "@/lib/ubigeosCatalogo";
import { etiquetaRutaZona, ocupacionPorZona, ordenarArbolZonas } from "@/lib/jerarquiaZonas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { AlmacenFormulario, ZonaFormulario } from "./AlmacenFormularios";
import { ETIQUETA_TIPO_ALMACEN } from "@/lib/tiposAlmacen";
import { CalendarioProduccionFormulario } from "./CalendarioProduccionFormulario";
import { actualizarTipoAlmacen, alternarActivoAlmacen, alternarActivoZona } from "./actions";

export default async function AlmacenesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) redirect("/");
  if (!(await puedeRealizar(usuario, "configuracion", "ver"))) redirect("/");

  const empresaId = await obtenerEmpresaActivaId();
  const [almacenes, arbol, saldosPorZona] = await Promise.all([
    prisma.almacen.findMany({
    where: { empresaId },
    include: {
      zonas: { include: { _count: { select: { presentaciones: true, insumos: true } } } },
      calendarioProduccion: { include: { diasNoLaborables: { orderBy: { fecha: "asc" } } } },
    },
      orderBy: { codigo: "asc" },
    }),
    arbolUbigeos(),
    // Ítems distintos con saldo en cada zona. Se cuentan ítems y no unidades:
    // sumar litros de aceite con unidades de balde daría un número sin
    // significado. Lo que hace falta al mirar el árbol es qué está ocupado.
    prisma.saldoZona.groupBy({
      by: ["zonaAlmacenId"],
      where: { zona: { almacen: { empresaId } }, cantidad: { not: 0 } },
      _count: { _all: true },
    }),
  ]);

  const itemsPorZona = new Map(saldosPorZona.map((s) => [s.zonaAlmacenId, s._count._all]));

  const porTipo = new Map<string, number>();
  for (const a of almacenes) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Almacenes y zonas
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a Warehouse / Warehouse Zone de Epicor: define dónde vive físicamente
        cada presentación e insumo, en vez de texto libre. El rol organizativo distingue una
        planta (fabrica, tiene calendario de producción) de un almacén de distribución o de
        tránsito.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(ETIQUETA_TIPO_ALMACEN).map(([valor, etiqueta]) => (
          <span key={valor} className="insignia bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {etiqueta}: {porTipo.get(valor) ?? 0}
          </span>
        ))}
      </div>

      <PanelMaestroDetalle
        registros={almacenes.map((a) => ({
          id: a.id,
          href: `#almacen-${a.id}`,
          primario: a.nombre,
          secundario: `${a.codigo} · ${ETIQUETA_TIPO_ALMACEN[a.tipo]}`,
        }))}
      >
      <div className="max-w-4xl">
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nuevo almacén</h2>
        <AlmacenFormulario arbolUbigeos={arbol} />
      </div>

      <div className="mt-4 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva zona</h2>
        <ZonaFormulario
          almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
          zonas={almacenes.flatMap((a) =>
            a.zonas.map((z) => ({
              id: z.id,
              almacenId: a.id,
              etiqueta: etiquetaRutaZona(z.id, a.zonas),
            }))
          )}
        />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {almacenes.map((a) => (
          <div key={a.id} id={`almacen-${a.id}`} className="border border-black/10 dark:border-white/10 rounded-lg p-4 scroll-mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {a.nombre} <span className="text-xs text-neutral-400 font-mono">{a.codigo}</span>
                </p>
                {(a.direccion || a.distrito || a.provincia || a.departamento) && (
                  <p className="text-sm text-neutral-500">
                    {[a.direccion, a.direccion2, a.distrito, a.provincia, a.departamento, a.pais]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {a.encargado && (
                  <p className="text-xs text-neutral-400">Encargado: {a.encargado}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await actualizarTipoAlmacen(a.id, String(formData.get("tipo") ?? ""));
                  }}
                  className="flex items-center gap-2"
                >
                  <select
                    aria-label={`Rol organizativo de ${a.nombre}`}
                    name="tipo"
                    defaultValue={a.tipo}
                    className="campo-input text-sm w-48"
                  >
                    {Object.entries(ETIQUETA_TIPO_ALMACEN).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    Guardar rol
                  </button>
                </form>
                <span
                  className={`insignia ${
                    a.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {a.activo ? "Activo" : "Inactivo"}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoAlmacen(a.id, !a.activo);
                  }}
                >
                  <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    {a.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            </div>

            <table className="tabla mt-3">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Descripción</th>
                  <th className="text-right">Ítems con stock</th>
                  <th>Presentaciones</th>
                  <th>Insumos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenarArbolZonas(a.zonas).map(({ zona: z, nivel }) => {
                  const ocupacion = ocupacionPorZona(a.zonas, itemsPorZona).get(z.id);
                  return (
                  <tr key={z.id}>
                    {/* La sangría es la jerarquía: un rack se lee debajo y
                        adentro de su pasillo. */}
                    <td className="font-mono text-xs" style={{ paddingLeft: `${nivel * 1.25 + 0.5}rem` }}>
                      {nivel > 0 && <span className="text-neutral-400">└ </span>}
                      {z.codigo}
                    </td>
                    <td className="text-neutral-500">{z.nombre ?? "—"}</td>
                    {/* Propio y subárbol siempre juntos: un pasillo que dice
                        "12" sin aclarar que once están en sus racks esconde el
                        dato que hace falta para ordenar el almacén. */}
                    <td className="text-right text-sm">
                      {ocupacion && ocupacion.subarbol > 0 ? (
                        <>
                          <span>{ocupacion.propia}</span>
                          {ocupacion.subarbol !== ocupacion.propia && (
                            <span className="text-neutral-500 text-xs">
                              {" "}
                              ({ocupacion.subarbol} con subzonas)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td>{z._count.presentaciones}</td>
                    <td>{z._count.insumos}</td>
                    <td>
                      <span
                        className={`insignia ${
                          z.activo
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                        }`}
                      >
                        {z.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="text-right">
                      <form
                        action={async () => {
                          "use server";
                          await alternarActivoZona(z.id, !z.activo);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-neutral-600 dark:text-neutral-400 hover:underline"
                        >
                          {z.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                  );
                })}
                {a.zonas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-neutral-500 py-3">
                      Sin zonas registradas en este almacén.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <CalendarioProduccionFormulario
              almacenId={a.id}
              horas={{
                horasLunes: a.calendarioProduccion?.horasLunes.toNumber() ?? 8,
                horasMartes: a.calendarioProduccion?.horasMartes.toNumber() ?? 8,
                horasMiercoles: a.calendarioProduccion?.horasMiercoles.toNumber() ?? 8,
                horasJueves: a.calendarioProduccion?.horasJueves.toNumber() ?? 8,
                horasViernes: a.calendarioProduccion?.horasViernes.toNumber() ?? 8,
                horasSabado: a.calendarioProduccion?.horasSabado.toNumber() ?? 0,
                horasDomingo: a.calendarioProduccion?.horasDomingo.toNumber() ?? 0,
              }}
              diasNoLaborables={(a.calendarioProduccion?.diasNoLaborables ?? []).map((d) => ({
                id: d.id,
                fecha: d.fecha.toISOString().slice(0, 10),
                motivo: d.motivo,
              }))}
            />
          </div>
        ))}
        {almacenes.length === 0 && (
          <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
            No hay almacenes registrados todavía.
          </p>
        )}
      </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
