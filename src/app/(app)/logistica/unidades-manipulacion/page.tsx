import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha } from "@/lib/format";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  ETIQUETA_ESTADO_HU,
  ETIQUETA_TIPO_HU,
  repartoEnZona,
} from "@/lib/unidadesManipulacion";
import {
  CargarFormulario,
  DesarmarFormulario,
  MoverFormulario,
  NuevaUnidadFormulario,
} from "./UnidadFormularios";

const COLOR_ESTADO: Record<string, string> = {
  EN_ALMACEN: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  EN_PLAYA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  VACIA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function UnidadesManipulacionPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const puedeEditar = await puedeRealizar(usuario, "materiales", "editar");

  const empresaId = await obtenerEmpresaActivaId();
  const [unidades, zonas, presentaciones, saldosZona, contenidos] = await Promise.all([
    prisma.unidadManipulacion.findMany({
      where: { empresaId },
      include: {
        zona: { select: { id: true, codigo: true, almacen: { select: { nombre: true } } } },
        contenidos: {
          include: { presentacion: { include: { producto: { select: { nombre: true } } } } },
          orderBy: { presentacionId: "asc" },
        },
      },
      orderBy: [{ estado: "asc" }, { codigo: "asc" }],
      take: 50,
    }),
    prisma.zonaAlmacen.findMany({
      where: { activo: true, almacen: { empresaId } },
      select: { id: true, codigo: true, almacen: { select: { nombre: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.presentacion.findMany({
      where: { empresaId, activo: true },
      select: { id: true, sku: true, nombre: true, producto: { select: { nombre: true } } },
      orderBy: { sku: "asc" },
    }),
    prisma.saldoZona.findMany({
      where: { zona: { almacen: { empresaId } }, tipoItem: "PRESENTACION" },
    }),
    // Todo lo que está sobre alguna unidad, para derivar el suelto por zona.
    prisma.unidadManipulacionContenido.findMany({
      where: { unidad: { empresaId, zonaAlmacenId: { not: null } } },
      include: { unidad: { select: { zonaAlmacenId: true } } },
    }),
  ]);

  const opcionesZona = zonas.map((z) => ({
    id: z.id,
    etiqueta: `${z.codigo} — ${z.almacen.nombre}`,
  }));
  const etiquetaPresentacion = new Map(
    presentaciones.map((p) => [p.id, `${p.producto.nombre} — ${p.nombre} (${p.sku})`])
  );

  /** Qué hay suelto en una zona, ítem por ítem: el saldo menos lo que ya está sobre unidades. */
  function sueltoEnZona(zonaId: string) {
    const deLaZona = contenidos.filter((c) => c.unidad.zonaAlmacenId === zonaId);
    return saldosZona
      .filter((s) => s.zonaAlmacenId === zonaId && s.cantidad.toNumber() > 0)
      .map((s) => {
        const reparto = repartoEnZona(
          s.cantidad.toNumber(),
          deLaZona.map((c) => ({
            presentacionId: c.presentacionId,
            cantidad: c.cantidad.toNumber(),
          })),
          s.itemId
        );
        return {
          id: s.itemId,
          etiqueta: etiquetaPresentacion.get(s.itemId) ?? s.itemId,
          suelto: reparto.suelto,
        };
      })
      .filter((p) => p.suelto > 0);
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Unidades de manipulación
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        El pallet, la caja o la jaula como cosa con nombre, para moverla y prepararla entera.
        <strong> Armar una unidad no crea ni destruye stock</strong>: lo que sube ya estaba contado
        en el saldo de su zona; solo deja de estar suelto en el rack.
      </p>

      {puedeEditar && <NuevaUnidadFormulario zonas={opcionesZona} />}

      <div className="mt-6 flex flex-col gap-4">
        {unidades.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
            Todavía no hay unidades armadas.
          </p>
        )}

        {unidades.map((u) => (
          <section key={u.id} className="borde-seccion">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                  <span className="font-mono">{u.codigo}</span>{" "}
                  <span className="text-xs font-normal text-neutral-500">
                    {ETIQUETA_TIPO_HU[u.tipo]}
                    {u.zona
                      ? ` · ${u.zona.codigo} (${u.zona.almacen.nombre})`
                      : " · fuera de zona"}
                  </span>
                </h2>
                <p className="text-xs text-neutral-500">
                  Armada por {u.usuarioNombre} el {formatFecha(u.creadoEn)}
                  {u.notas && ` · ${u.notas}`}
                </p>
              </div>
              <span className={`insignia ${COLOR_ESTADO[u.estado]}`}>
                {ETIQUETA_ESTADO_HU[u.estado]}
              </span>
            </div>

            {u.contenidos.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Presentación</th>
                      <th className="text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.contenidos.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.presentacion.producto.nombre} — {c.presentacion.nombre}
                          <span className="ml-2 font-mono text-xs text-neutral-400">
                            {c.presentacion.sku}
                          </span>
                        </td>
                        <td className="text-right">{c.cantidad.toNumber()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">Sin contenido.</p>
            )}

            {puedeEditar && u.estado !== "EN_PLAYA" && u.zona && (
              <div className="mt-4 flex flex-col gap-3">
                <CargarFormulario unidadId={u.id} presentaciones={sueltoEnZona(u.zona.id)} />
                <MoverFormulario
                  unidadId={u.id}
                  zonas={opcionesZona.filter((z) => z.id !== u.zona!.id)}
                />
                {u.contenidos.length > 0 && <DesarmarFormulario unidadId={u.id} />}
              </div>
            )}

            {u.estado === "EN_PLAYA" && (
              <p className="mt-3 text-xs text-neutral-500">
                Preparada y esperando en la playa de despacho: su contenido ya no suma al saldo de
                ninguna zona. Sale del almacén cuando salga su guía.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
