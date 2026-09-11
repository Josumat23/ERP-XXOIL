import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatFecha, formatMoneda, formatNumero } from "@/lib/format";
import { obtenerUsuario, requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { calcularDemanda, calcularOperaciones, type DetalleCalculado } from "@/lib/proyecciones";
import { crearOrdenCompraDesdeDatos } from "@/lib/ordenesCompra";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { seleccionarFuenteAprovisionamiento, type FuenteAcuerdo } from "@/lib/fuentesAprovisionamiento";
import { calcularFechaEntrega } from "@/lib/reservasProduccion";

const NOMBRE_TRIMESTRE: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3", 4: "T4" };

export default async function MrpPage({
  searchParams,
}: {
  searchParams: Promise<{ proyeccionId?: string; almacenId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/");
  if (!(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const { proyeccionId, almacenId: almacenSolicitado } = await searchParams;

  // Plantas de la compañía. El id llega de la URL: se relee acotado a la
  // compañía activa antes de usarlo para planificar.
  const plantas = await prisma.almacen.findMany({
    where: { empresaId, tipo: "PLANTA", activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const almacenId = plantas.some((p) => p.id === almacenSolicitado) ? almacenSolicitado! : null;
  const plantaActiva = plantas.find((p) => p.id === almacenId) ?? null;

  const proyecciones = await prisma.proyeccion.findMany({
    where: { empresaId },
    orderBy: [{ anio: "desc" }, { trimestre: "desc" }],
  });

  const proyeccionActiva = proyeccionId
    ? proyecciones.find((p) => p.id === proyeccionId)
    : proyecciones[0];

  if (!proyeccionActiva) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
          MRP — Necesidades de compra
        </h1>
        <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
          Todavía no hay ninguna proyección creada. El MRP explota la demanda proyectada contra las
          fórmulas de producción para sugerir qué comprar — primero crea una proyección en{" "}
          <Link href="/proyecciones" className="hover:underline">
            Proyecciones
          </Link>
          .
        </p>
      </div>
    );
  }

  const proyeccionCompleta = await prisma.proyeccion.findUniqueOrThrow({
    where: { id: proyeccionActiva.id },
    include: { detalles: { include: { presentacion: { include: { producto: true } } } } },
  });

  const detallesBase = proyeccionCompleta.detalles.map((d) => ({
    presentacionId: d.presentacionId,
    nombre: `${d.presentacion.producto.nombre} — ${d.presentacion.nombre}`,
    productoId: d.presentacion.productoId,
    contenidoKg: d.presentacion.contenidoKg.toNumber(),
    precio: d.presentacion.precio.toNumber(),
    costoPromedio: d.presentacion.costoPromedio.toNumber(),
    stock: d.presentacion.stock.toNumber(),
    stockReservado: d.presentacion.stockReservado.toNumber(),
    stockMinimo: d.presentacion.stockMinimo.toNumber(),
    ventasBase: d.ventasBase.toNumber(),
    indiceEstacionalidad: d.indiceEstacionalidad.toNumber(),
    sinHistorico: d.ventasBase.toNumber() === 0,
    ajusteCualitativoPct: d.ajusteCualitativoPct.toNumber(),
  }));

  const detalles: DetalleCalculado[] = calcularDemanda(
    detallesBase,
    proyeccionCompleta.crecimientoMercadoPct.toNumber(),
    proyeccionCompleta.factorCompetenciaPct.toNumber()
  );

  const operaciones = await calcularOperaciones(
    detalles,
    proyeccionCompleta.anio,
    proyeccionCompleta.trimestre,
    empresaId,
    almacenId,
  );

  const insumosAComprar = operaciones.insumos.filter((i) => i.aComprar > 0);
  const insumosConProveedor = await prisma.insumo.findMany({
    where: { empresaId, id: { in: insumosAComprar.map((i) => i.insumoId) } },
    include: {
      proveedor: true,
      lineasAcuerdo: {
        where: {
          acuerdo: {
            empresaId,
            estado: "ACTIVO",
            vigenteDesde: { lte: new Date() },
            vigenteHasta: { gte: new Date() },
          },
        },
        include: { acuerdo: { include: { proveedor: true } } },
      },
    },
  });
  const insumoPorId = new Map(insumosConProveedor.map((i) => [i.id, i]));

  type GrupoProveedor = {
    proveedorId: string | null;
    clave: string;
    proveedorNombre: string;
    acuerdoId: string | null;
    fuente: string;
    moneda: "PEN" | "USD";
    tipoCambio: number;
    lineas: { insumoId: string; nombre: string; unidadMedida: string; necesidadNeta: number; cantidad: number; costoUnitario: number; fechaEntregaEsperada: Date; plazoEntregaDias: number; acuerdoLineaId?: string }[];
  };
  const grupos = new Map<string, GrupoProveedor>();
  for (const i of insumosAComprar) {
    const insumo = insumoPorId.get(i.insumoId);
    const candidatas: FuenteAcuerdo[] = (insumo?.lineasAcuerdo ?? [])
      .filter((linea) => linea.acuerdo.moneda === "PEN" || linea.acuerdo.moneda === "USD")
      .map((linea) => ({
        acuerdoId: linea.acuerdoId,
        acuerdoLineaId: linea.id,
        proveedorId: linea.acuerdo.proveedorId,
        proveedorNombre: linea.acuerdo.proveedor.razonSocial,
        precioUnitario: linea.precioUnitario.toNumber(),
        moneda: linea.acuerdo.moneda as "PEN" | "USD",
        tipoCambio: linea.acuerdo.tipoCambio.toNumber(),
        saldo: linea.cantidadComprometida.minus(linea.cantidadLiberada).toNumber(),
      }));
    const fuente = seleccionarFuenteAprovisionamiento(i.aComprar, candidatas);
    const proveedor = fuente ? null : insumo?.proveedor ?? null;
    const clave = fuente ? `acuerdo:${fuente.acuerdoId}` : proveedor?.id ?? "sin-proveedor";
    const grupo = grupos.get(clave) ?? {
      proveedorId: fuente?.proveedorId ?? proveedor?.id ?? null,
      clave,
      proveedorNombre: fuente?.proveedorNombre ?? proveedor?.razonSocial ?? "Sin proveedor asignado",
      acuerdoId: fuente?.acuerdoId ?? null,
      fuente: fuente ? "Acuerdo vigente seleccionado por menor costo normalizado" : "Proveedor predeterminado del material",
      moneda: fuente?.moneda ?? "PEN",
      tipoCambio: fuente?.tipoCambio ?? 1,
      lineas: [],
    };
    grupo.lineas.push({
      insumoId: i.insumoId,
      nombre: i.nombre,
      unidadMedida: i.unidadMedida,
      necesidadNeta: i.necesidadNeta,
      cantidad: i.aComprar,
      costoUnitario: fuente?.precioUnitario ?? i.costoUnitario,
      plazoEntregaDias: i.plazoEntregaDias,
      fechaEntregaEsperada: calcularFechaEntrega(new Date(), i.plazoEntregaDias),
      ...(fuente ? { acuerdoLineaId: fuente.acuerdoLineaId } : {}),
    });
    grupos.set(clave, grupo);
  }

  const puedeGenerarOC =
    (usuario.rol === "ADMIN" || usuario.rol === "ALMACEN") &&
    (await puedeRealizar(usuario, "materiales", "crear"));

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        MRP — Necesidades de compra
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Explota la demanda proyectada contra las fórmulas, el stock físico y las reservas de órdenes planificadas —
        lo mismo que calcula la pestaña Operaciones de Proyecciones, agrupado aquí por proveedor
        para generar la orden de compra directamente.
      </p>

      {plantaActiva && (
        <p className="text-xs mb-4 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 max-w-3xl">
          Planificando para <strong>{plantaActiva.nombre}</strong>: el neteo usa el stock de esa
          planta y solo sus pedidos firmes. <strong>El pronóstico queda fuera</strong> — la
          proyección no distingue plantas, y repartirla entre ellas exige un criterio de asignación
          que es una decisión del negocio, no del sistema. Para planificar con pronóstico, elija
          &quot;Toda la compañía&quot;.
        </p>
      )}

      <form method="get" className="flex items-end gap-3 mb-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Proyección</span>
          <select name="proyeccionId" defaultValue={proyeccionActiva.id} className="campo-input">
            {proyecciones.map((p) => (
              <option key={p.id} value={p.id}>
                {NOMBRE_TRIMESTRE[p.trimestre]} {p.anio}
              </option>
            ))}
          </select>
        </label>
        {plantas.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Planta</span>
            <select name="almacenId" defaultValue={almacenId ?? ""} className="campo-input">
              <option value="">Toda la compañía</option>
              {plantas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="boton-secundario">
          Ver
        </button>
        <Link
          href={`/proyecciones/${proyeccionActiva.id}`}
          className="text-sm text-neutral-500 hover:underline ml-2"
        >
          Ver proyección completa →
        </Link>
      </form>

      <section className="mb-6">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Neteo de demanda</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Se planifica el mayor valor entre pronóstico y pedidos firmes pendientes; así el backlog consume el
          pronóstico sin contarse dos veces. Los pedidos vencidos o sin fecha también se incluyen.
        </p>
        <table className="tabla">
          <thead><tr><th>Presentación</th><th className="text-right">Pronóstico</th><th className="text-right">Pedidos firmes</th><th className="text-right">Demanda planificada</th></tr></thead>
          <tbody>
            {operaciones.demandaNeteada.map((demanda) => (
              <tr key={demanda.presentacionId}>
                <td>{demanda.nombre}</td>
                <td className="text-right">{formatNumero(demanda.pronostico, 0)}</td>
                <td className="text-right">{formatNumero(demanda.pedidosFirmes, 0)}</td>
                <td className="text-right font-medium">{formatNumero(demanda.demandaPlanificada, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {operaciones.presentacionesSinFormula.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mb-4">
          Sin fórmula activa (no se pudo estimar consumo): {operaciones.presentacionesSinFormula.join(", ")}
        </p>
      )}

      {grupos.size === 0 ? (
        <p className="text-sm text-neutral-500">
          No hay ningún insumo que falte comprar para esta proyección — el stock actual alcanza.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...grupos.values()].map((grupo) => {
            const subtotalGrupo = grupo.lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
            return (
              <section
                key={grupo.clave}
                className="border border-black/10 dark:border-white/10 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                    {grupo.proveedorNombre}
                  </h2>
                  {puedeGenerarOC && grupo.proveedorId && (
                    <form
                      action={async () => {
                        "use server";
                        const auth = await requerirRol(["ALMACEN"]);
                        if ("error" in auth) return;
                        if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) return;

                        const ocId = await crearOrdenCompraDesdeDatos(
                          {
                            proveedorId: grupo.proveedorId!,
                            almacenId,
                            notas: `Sugerida por MRP — ${NOMBRE_TRIMESTRE[proyeccionCompleta.trimestre]} ${proyeccionCompleta.anio}`,
                            moneda: grupo.moneda,
                            tipoCambio: grupo.tipoCambio,
                            acuerdoId: grupo.acuerdoId,
                            lineas: grupo.lineas.map((l) => ({
                              insumoId: l.insumoId,
                              cantidad: l.cantidad,
                              costoUnitario: l.costoUnitario,
                              fechaEntregaEsperada: l.fechaEntregaEsperada,
                            })),
                            lineasAcuerdo: grupo.acuerdoId
                              ? grupo.lineas.map((l) => ({
                                  insumoId: l.insumoId,
                                  cantidad: l.cantidad,
                                  costoUnitario: l.costoUnitario,
                                  fechaEntregaEsperada: l.fechaEntregaEsperada,
                                  acuerdoLineaId: l.acuerdoLineaId!,
                                }))
                              : undefined,
                          },
                          { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre, empresaId: auth.usuario.empresaId }
                        );
                        redirect(`/logistica/ordenes-compra/${ocId}`);
                      }}
                    >
                      <button type="submit" className="boton-primario text-sm px-3 py-1.5">
                        Generar orden de compra sugerida
                      </button>
                    </form>
                  )}
                </div>
                <p className="mb-2 text-xs text-neutral-500">
                  {grupo.fuente}
                  {grupo.acuerdoId ? ` · ${grupo.moneda}${grupo.moneda === "USD" ? ` · TC ${grupo.tipoCambio}` : ""}` : ""}
                </p>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th className="text-right">A comprar</th>
                      <th className="text-right">Necesidad neta</th>
                      <th>Entrega estimada</th>
                      <th className="text-right">Costo unit.</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.lineas.map((l) => (
                      <tr key={l.insumoId}>
                        <td>{l.nombre}</td>
                        <td className="text-right">
                          {formatNumero(l.cantidad, 0)} {l.unidadMedida}
                        </td>
                        <td className="text-right">{formatNumero(l.necesidadNeta, 0)}</td>
                        <td>{formatFecha(l.fechaEntregaEsperada)} · {l.plazoEntregaDias} días</td>
                        <td className="text-right">{formatMoneda(l.costoUnitario, grupo.moneda)}</td>
                        <td className="text-right">{formatMoneda(l.cantidad * l.costoUnitario, grupo.moneda)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="text-right font-semibold">
                        Subtotal
                      </td>
                      <td className="text-right font-semibold">{formatMoneda(subtotalGrupo, grupo.moneda)}</td>
                    </tr>
                  </tbody>
                </table>
                {!grupo.proveedorId && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                    Estos insumos no tienen proveedor asignado en su ficha — asígnalo en Catálogo →
                    Insumos para poder generar la orden de compra.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
