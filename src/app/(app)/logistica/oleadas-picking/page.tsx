import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha } from "@/lib/format";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { avanceDeOleada, esElegible, sugerenciasDeZona } from "@/lib/oleadaPicking";
import { distribucionZonas } from "@/lib/saldosZona";
import { CerrarOleadaFormularios, NuevaOleadaFormulario, PickFormulario } from "./OleadaFormularios";

const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  COMPLETADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function OleadasPickingPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const puedeEditar = await puedeRealizar(usuario, "materiales", "editar");

  const empresaId = await obtenerEmpresaActivaId();
  const [guiasRaw, oleadas] = await Promise.all([
    prisma.guiaRemision.findMany({
      where: { empresaId, estadoDespacho: "PLANIFICADO" },
      include: {
        cliente: { select: { razonSocial: true } },
        pedido: { select: { almacenId: true, requiereEntrega: true } },
        detalles: { select: { id: true } },
        oleadas: { select: { oleada: { select: { id: true, estado: true } } } },
      },
      orderBy: { creadoEn: "asc" },
      take: 100,
    }),
    prisma.oleadaPicking.findMany({
      where: { empresaId },
      include: {
        almacen: { select: { nombre: true } },
        guias: { include: { guia: { select: { id: true, numero: true, estadoDespacho: true } } } },
        lineas: {
          include: { presentacion: { include: { producto: { select: { nombre: true } } } } },
          orderBy: { presentacionId: "asc" },
        },
      },
      orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
      take: 25,
    }),
  ]);

  const almacenes = new Map(
    (await prisma.almacen.findMany({ where: { empresaId }, select: { id: true, nombre: true } })).map(
      (a) => [a.id, a.nombre]
    )
  );

  const guiasElegibles = guiasRaw
    .map((g) => ({
      id: g.id,
      numero: g.numero,
      estadoDespacho: g.estadoDespacho,
      almacenId: g.pedido?.almacenId ?? null,
      requiereEntrega: g.pedido?.requiereEntrega ?? false,
      oleadaAbiertaId: g.oleadas.find((o) => o.oleada.estado === "ABIERTA")?.oleada.id ?? null,
      cliente: g.cliente.razonSocial,
      lineas: g.detalles.length,
    }))
    .filter(esElegible)
    .map((g) => ({
      id: g.id,
      numero: g.numero,
      cliente: g.cliente,
      almacen: almacenes.get(g.almacenId!) ?? "—",
      lineas: g.lineas,
    }));

  // El reparto por zona de cada ítem de las oleadas abiertas, para sugerir de
  // dónde tomarlo. Se lee aquí y no por línea para no repetir la consulta.
  const abiertas = oleadas.filter((o) => o.estado === "ABIERTA");
  const clavesItem = abiertas.flatMap((o) =>
    o.lineas.map((l) => ({ almacenId: o.almacenId, presentacionId: l.presentacionId }))
  );
  const [saldosAlmacen, saldosZona, zonas] = await Promise.all([
    clavesItem.length
      ? prisma.saldoAlmacen.findMany({
          where: {
            tipoItem: "PRESENTACION",
            OR: clavesItem.map((c) => ({
              almacenId: c.almacenId,
              presentacionId: c.presentacionId,
            })),
          },
        })
      : [],
    clavesItem.length
      ? prisma.saldoZona.findMany({
          where: { itemId: { in: clavesItem.map((c) => c.presentacionId) } },
          include: { zona: { select: { id: true, codigo: true, almacenId: true } } },
        })
      : [],
    prisma.zonaAlmacen.findMany({ where: { almacen: { empresaId } }, select: { id: true, codigo: true } }),
  ]);
  const codigoZona = new Map(zonas.map((z) => [z.id, z.codigo]));

  function sugerenciasPara(almacenId: string, presentacionId: string) {
    const saldo = saldosAlmacen.find(
      (s) => s.almacenId === almacenId && s.presentacionId === presentacionId
    );
    const delItem = saldosZona.filter(
      (s) => s.itemId === presentacionId && s.zona.almacenId === almacenId
    );
    const distribucion = distribucionZonas(
      saldo?.cantidad.toNumber() ?? 0,
      delItem.map((s) => ({ zonaAlmacenId: s.zonaAlmacenId, cantidad: s.cantidad.toNumber() }))
    );
    return sugerenciasDeZona(
      distribucion.porZona.map((z) => ({
        zonaAlmacenId: z.zonaAlmacenId,
        codigo: codigoZona.get(z.zonaAlmacenId) ?? z.zonaAlmacenId,
        cantidad: z.cantidad,
      })),
      distribucion.sinZona
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Picking por oleadas
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        Preparar varias guías en una sola recorrida. La lista se consolida por presentación y sugiere
        de qué zona tomar cada ítem. <strong>Preparar no descuenta inventario</strong>: la salida la
        hace la guía cuando el camión sale. Lo que se mueve es la ubicación — el ítem deja su zona y
        queda en la playa de despacho.
      </p>

      {puedeEditar && <NuevaOleadaFormulario guias={guiasElegibles} />}

      <div className="mt-6 flex flex-col gap-4">
        {oleadas.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
            Todavía no hay oleadas.
          </p>
        )}

        {oleadas.map((o) => {
          const avance = avanceDeOleada(
            o.lineas.map((l) => ({
              cantidadRequerida: l.cantidadRequerida.toNumber(),
              cantidadPickeada: l.cantidadPickeada.toNumber(),
            }))
          );
          return (
            <section key={o.id} className="borde-seccion">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                    {o.numero}{" "}
                    <span className="text-xs font-normal text-neutral-500">
                      {o.almacen.nombre} · {o.guias.length} guía(s)
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Armada por {o.usuarioNombre} el {formatFecha(o.creadoEn)} ·{" "}
                    {avance.pickeado} de {avance.requerido} unidades preparadas
                    {o.completadaPorNombre &&
                      ` · cerrada por ${o.completadaPorNombre}`}
                  </p>
                </div>
                <span className={`insignia ${COLOR_ESTADO[o.estado]}`}>{o.estado}</span>
              </div>

              <p className="mt-1 text-xs text-neutral-500">
                Guías:{" "}
                {o.guias.map((g) => (
                  <Link
                    key={g.guia.id}
                    href={`/logistica/guias-remision/${g.guia.id}`}
                    className="mr-2 font-mono text-[var(--epicor-azul)] hover:underline"
                  >
                    {g.guia.numero}
                  </Link>
                ))}
              </p>
              {o.notas && <p className="mt-1 text-xs text-neutral-500">{o.notas}</p>}

              <div className="mt-3 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Presentación</th>
                      <th className="text-right">Requerido</th>
                      <th className="text-right">Preparado</th>
                      <th className="text-right">Pendiente</th>
                      {o.estado === "ABIERTA" && puedeEditar && <th>Tomar de</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {o.lineas.map((l) => {
                      const requerida = l.cantidadRequerida.toNumber();
                      const pickeada = l.cantidadPickeada.toNumber();
                      const pendiente = Math.max(0, requerida - pickeada);
                      return (
                        <tr key={l.id}>
                          <td>
                            {l.presentacion.producto.nombre} — {l.presentacion.nombre}
                            <span className="ml-2 font-mono text-xs text-neutral-400">
                              {l.presentacion.sku}
                            </span>
                          </td>
                          <td className="text-right">{requerida}</td>
                          <td className="text-right">{pickeada}</td>
                          <td className={`text-right ${pendiente > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
                            {pendiente}
                          </td>
                          {o.estado === "ABIERTA" && puedeEditar && (
                            <td>
                              {pendiente > 0 ? (
                                <PickFormulario
                                  lineaId={l.id}
                                  zonas={sugerenciasPara(o.almacenId, l.presentacionId)}
                                  pendiente={pendiente}
                                />
                              ) : (
                                <span className="text-xs text-green-700 dark:text-green-400">Completa</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {o.estado === "ABIERTA" && puedeEditar && (
                <CerrarOleadaFormularios oleadaId={o.id} faltante={avance.faltante} />
              )}
              {o.estado === "CANCELADA" && (
                <p className="mt-3 text-sm text-neutral-500">
                  <span className="font-medium">Cancelada:</span> {o.motivoCancelacion}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
