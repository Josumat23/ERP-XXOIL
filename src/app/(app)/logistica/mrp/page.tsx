import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import { obtenerUsuario, requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { calcularDemanda, calcularOperaciones, type DetalleCalculado } from "@/lib/proyecciones";
import { crearOrdenCompraDesdeDatos } from "../ordenes-compra/actions";

const NOMBRE_TRIMESTRE: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3", 4: "T4" };

export default async function MrpPage({
  searchParams,
}: {
  searchParams: Promise<{ proyeccionId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/");

  const { proyeccionId } = await searchParams;

  const proyecciones = await prisma.proyeccion.findMany({
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
    proyeccionCompleta.trimestre
  );

  const insumosAComprar = operaciones.insumos.filter((i) => i.aComprar > 0);
  const insumosConProveedor = await prisma.insumo.findMany({
    where: { id: { in: insumosAComprar.map((i) => i.insumoId) } },
    include: { proveedor: true },
  });
  const proveedorPorInsumo = new Map(insumosConProveedor.map((i) => [i.id, i.proveedor]));

  type GrupoProveedor = {
    proveedorId: string | null;
    proveedorNombre: string;
    lineas: { insumoId: string; nombre: string; unidadMedida: string; cantidad: number; costoUnitario: number }[];
  };
  const grupos = new Map<string, GrupoProveedor>();
  for (const i of insumosAComprar) {
    const proveedor = proveedorPorInsumo.get(i.insumoId) ?? null;
    const clave = proveedor?.id ?? "sin-proveedor";
    const grupo = grupos.get(clave) ?? {
      proveedorId: proveedor?.id ?? null,
      proveedorNombre: proveedor?.razonSocial ?? "Sin proveedor asignado",
      lineas: [],
    };
    grupo.lineas.push({
      insumoId: i.insumoId,
      nombre: i.nombre,
      unidadMedida: i.unidadMedida,
      cantidad: i.aComprar,
      costoUnitario: i.costoUnitario,
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
        Explota la demanda proyectada contra las fórmulas de producción (BOM) y el stock actual —
        lo mismo que calcula la pestaña Operaciones de Proyecciones, agrupado aquí por proveedor
        para generar la orden de compra directamente.
      </p>

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
                key={grupo.proveedorId ?? "sin-proveedor"}
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
                            almacenId: null,
                            notas: `Sugerida por MRP — ${NOMBRE_TRIMESTRE[proyeccionCompleta.trimestre]} ${proyeccionCompleta.anio}`,
                            moneda: "PEN",
                            tipoCambio: 1,
                            lineas: grupo.lineas.map((l) => ({
                              insumoId: l.insumoId,
                              cantidad: l.cantidad,
                              costoUnitario: l.costoUnitario,
                            })),
                          },
                          { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
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
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th className="text-right">A comprar</th>
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
                        <td className="text-right">{formatMoneda(l.costoUnitario)}</td>
                        <td className="text-right">{formatMoneda(l.cantidad * l.costoUnitario)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="text-right font-semibold">
                        Subtotal
                      </td>
                      <td className="text-right font-semibold">{formatMoneda(subtotalGrupo)}</td>
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
