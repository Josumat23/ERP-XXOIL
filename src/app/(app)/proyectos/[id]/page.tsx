import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatFecha } from "@/lib/format";
import { costoRealProyecto } from "@/lib/proyectos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BotonEliminarConfirmacion from "@/components/BotonEliminarConfirmacion";
import EdtFormulario from "../EdtFormulario";
import ActividadFormulario from "../ActividadFormulario";
import PrecedenciaFormulario from "../PrecedenciaFormulario";
import CostoProyectoFormulario from "../CostoProyectoFormulario";
import {
  crearEdt,
  crearActividad,
  eliminarActividad,
  crearPrecedencia,
  eliminarPrecedencia,
  agregarCostoProyecto,
  cambiarEstadoProyecto,
} from "../actions";

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICADO: "Planificado",
  EN_PROGRESO: "En progreso",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

const CLASE_ESTADO: Record<string, string> = {
  PLANIFICADO: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  EN_PROGRESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  CERRADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

type EdtConActividades = NonNullable<Awaited<ReturnType<typeof cargarProyecto>>>["edts"][number];

async function cargarProyecto(id: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      centroCosto: true,
      responsable: true,
      costos: { include: { edt: true }, orderBy: { fecha: "desc" } },
      ordenesCompra: { include: { proveedor: true } },
      activosFijos: true,
    },
  });
  if (!proyecto) return null;
  const edts = await prisma.edtProyecto.findMany({
    where: { proyectoId: id },
    include: { actividades: { include: { responsable: true, equipo: true }, orderBy: { codigo: "asc" } } },
    orderBy: { codigo: "asc" },
  });
  return { ...proyecto, edts };
}

export default async function DetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "proyectos", "ver"))) redirect("/");

  const { id } = await params;

  const [proyecto, proyectos, empleados, equipos, precedencias] = await Promise.all([
    cargarProyecto(id),
    prisma.proyecto.findMany({ orderBy: { creadoEn: "desc" } }),
    prisma.empleado.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombres: "asc" } }),
    prisma.equipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.precedenciaActividad.findMany({
      where: { predecesora: { edt: { proyectoId: id } } },
      include: { predecesora: true, sucesora: true },
    }),
  ]);
  if (!proyecto) notFound();

  const costoReal = await costoRealProyecto(prisma, id);
  const presupuesto = proyecto.presupuestoTotal.toNumber();
  const excede = costoReal > presupuesto;

  const edtsPorParent = new Map<string | null, EdtConActividades[]>();
  for (const edt of proyecto.edts) {
    const clave = edt.parentId;
    if (!edtsPorParent.has(clave)) edtsPorParent.set(clave, []);
    edtsPorParent.get(clave)!.push(edt);
  }

  const opcionesEdt = proyecto.edts.map((e) => ({ id: e.id, etiqueta: `${e.codigo} — ${e.nombre}` }));
  const opcionesEmpleado = empleados.map((e) => ({ id: e.id, etiqueta: `${e.nombres} ${e.apellidos}` }));
  const opcionesEquipo = equipos.map((e) => ({ id: e.id, etiqueta: `${e.codigo} — ${e.nombre}` }));
  const todasActividades = proyecto.edts.flatMap((e) =>
    e.actividades.map((a) => ({ id: a.id, etiqueta: `${e.codigo}/${a.codigo} — ${a.nombre}` }))
  );

  function renderEdt(edt: EdtConActividades): React.ReactNode {
    const hijos = edtsPorParent.get(edt.id) ?? [];
    return (
      <div key={edt.id} className="border-l-2 pl-3 mb-4" style={{ borderColor: "var(--epicor-borde)" }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-neutral-500">{edt.codigo}</span>
          <span className="font-medium">{edt.nombre}</span>
          {edt.presupuesto != null && (
            <span className="text-xs text-neutral-500">({formatMoneda(edt.presupuesto.toNumber())})</span>
          )}
        </div>

        {edt.actividades.length > 0 && (
          <table className="tabla mt-2 mb-2">
            <thead>
              <tr>
                <th>Código</th>
                <th>Actividad</th>
                <th>Duración</th>
                <th>Inicio plan</th>
                <th>Fin plan</th>
                <th>Holgura</th>
                <th>Responsable</th>
                <th>Equipo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {edt.actividades.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.codigo}</td>
                  <td>
                    {a.nombre}
                    {a.esCritica && (
                      <span className="insignia bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 ml-2">
                        Crítica
                      </span>
                    )}
                  </td>
                  <td>{a.duracionDias} d</td>
                  <td className="text-sm">{a.fechaInicioPlan ? formatFecha(a.fechaInicioPlan) : "—"}</td>
                  <td className="text-sm">{a.fechaFinPlan ? formatFecha(a.fechaFinPlan) : "—"}</td>
                  <td>{a.holguraDias} d</td>
                  <td className="text-sm">
                    {a.responsable ? `${a.responsable.nombres} ${a.responsable.apellidos}` : "—"}
                  </td>
                  <td className="text-sm">{a.equipo?.nombre ?? "—"}</td>
                  <td className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await eliminarActividad(a.id);
                      }}
                    >
                      <BotonEliminarConfirmacion descripcion={`la actividad ${a.codigo} — ${a.nombre}`} />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <ActividadFormulario
          accion={crearActividad.bind(null, edt.id)}
          empleados={opcionesEmpleado}
          equipos={opcionesEquipo}
        />

        {hijos.length > 0 && <div className="mt-3">{hijos.map((h) => renderEdt(h))}</div>}
      </div>
    );
  }

  return (
    <div>
      <Link href="/proyectos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proyectos
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/proyectos/nuevo"
        nuevoTexto="Nuevo proyecto"
        registros={proyectos.map((p) => ({
          id: p.id,
          href: `/proyectos/${p.id}`,
          primario: p.codigo,
          secundario: p.nombre,
        }))}
      >
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
              {proyecto.codigo} — {proyecto.nombre}
            </h1>
            <span className={`insignia ${CLASE_ESTADO[proyecto.estado]}`}>{ETIQUETA_ESTADO[proyecto.estado]}</span>
          </div>
          {proyecto.descripcion && (
            <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
              {proyecto.descripcion}
            </p>
          )}
          <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            {formatFecha(proyecto.fechaInicioPlan)} – {formatFecha(proyecto.fechaFinPlan)}
            {proyecto.responsable ? ` · Responsable: ${proyecto.responsable.nombres} ${proyecto.responsable.apellidos}` : ""}
            {proyecto.centroCosto ? ` · Sponsor: ${proyecto.centroCosto.nombre}` : ""}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-4 max-w-md">
            <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
              <p className="text-xs text-neutral-500">Costo real</p>
              <p
                className={`text-xl font-semibold mt-0.5 ${
                  excede ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                {formatMoneda(costoReal)}
              </p>
            </div>
            <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
              <p className="text-xs text-neutral-500">Presupuesto total</p>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {formatMoneda(presupuesto)}
              </p>
            </div>
          </div>
          {excede && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              El costo real ya superó el presupuesto. Esto no bloquea nada, solo alerta.
            </p>
          )}

          <form
            className="flex items-center gap-2 mt-4"
            action={async (formData) => {
              "use server";
              await cambiarEstadoProyecto(id, String(formData.get("estado")));
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
              <select name="estado" defaultValue={proyecto.estado} className="campo-input">
                {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton-secundario">
              Cambiar estado
            </button>
          </form>

          <section className="mt-8">
            <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
              WBS — Fases y actividades
            </h2>
            {(edtsPorParent.get(null) ?? []).map((edt) => renderEdt(edt))}
            {proyecto.edts.length === 0 && (
              <p className="text-sm text-neutral-500 mb-3">Todavía no se agregó ninguna fase.</p>
            )}
            <div className="mt-2">
              <EdtFormulario accion={crearEdt.bind(null, id)} edts={opcionesEdt} />
            </div>
          </section>

          {todasActividades.length >= 2 && (
            <section className="mt-8">
              <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
                Precedencias (ruta crítica)
              </h2>
              {precedencias.length > 0 && (
                <table className="tabla mb-2">
                  <thead>
                    <tr>
                      <th>Predecesora</th>
                      <th>Sucesora</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precedencias.map((p) => (
                      <tr key={p.id}>
                        <td>{p.predecesora.nombre}</td>
                        <td>{p.sucesora.nombre}</td>
                        <td className="text-right">
                          <form
                            action={async () => {
                              "use server";
                              await eliminarPrecedencia(p.id);
                            }}
                          >
                            <BotonEliminarConfirmacion
                              descripcion={`la precedencia ${p.predecesora.nombre} → ${p.sucesora.nombre}`}
                            />
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <PrecedenciaFormulario accion={crearPrecedencia.bind(null, id)} actividades={todasActividades} />
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
              Costos reales
            </h2>
            <table className="tabla mb-2">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Fase</th>
                  <th>Registrado por</th>
                  <th className="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {proyecto.costos.map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm">{formatFecha(c.fecha)}</td>
                    <td>{c.concepto}</td>
                    <td className="text-sm text-neutral-500">{c.edt?.nombre ?? "—"}</td>
                    <td className="text-sm text-neutral-500">{c.usuarioNombre}</td>
                    <td className="text-right">{formatMoneda(c.monto.toNumber())}</td>
                  </tr>
                ))}
                {proyecto.ordenesCompra.length === 0 && proyecto.costos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-neutral-500 py-4">
                      Todavía no se registró ningún costo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <CostoProyectoFormulario accion={agregarCostoProyecto.bind(null, id)} edts={opcionesEdt} />
          </section>

          {proyecto.ordenesCompra.length > 0 && (
            <section className="mt-8">
              <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
                Órdenes de compra etiquetadas
              </h2>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Proveedor</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecto.ordenesCompra.map((oc) => (
                    <tr key={oc.id}>
                      <td className="font-mono text-xs">{oc.numero}</td>
                      <td>{oc.proveedor.razonSocial}</td>
                      <td className="text-sm">{oc.estado}</td>
                      <td className="text-right">{formatMoneda(oc.total.toNumber(), oc.moneda)}</td>
                      <td className="text-right">
                        <Link
                          href={`/logistica/ordenes-compra/${oc.id}`}
                          className="text-neutral-600 dark:text-neutral-400 hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
              Activos fijos capitalizados
            </h2>
            {proyecto.activosFijos.length > 0 ? (
              <table className="tabla mb-3">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th className="text-right">Costo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecto.activosFijos.map((af) => (
                    <tr key={af.id}>
                      <td className="font-mono text-xs">{af.codigo}</td>
                      <td>{af.nombre}</td>
                      <td className="text-right">{formatMoneda(af.costoAdquisicion.toNumber())}</td>
                      <td className="text-right">
                        <Link
                          href={`/finanzas/activos-fijos/${af.id}`}
                          className="text-neutral-600 dark:text-neutral-400 hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-neutral-500 mb-2">Todavía no se capitalizó ningún activo.</p>
            )}
            <Link href={`/finanzas/activos-fijos/nuevo?proyectoId=${id}`} className="boton-secundario inline-block">
              Capitalizar como activo fijo
            </Link>
          </section>
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
