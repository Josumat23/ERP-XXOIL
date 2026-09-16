import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import BotonImprimir from "@/components/BotonImprimir";
import { composicionTanque } from "@/lib/tanques";
import { descargarRecepcion } from "../actions";
import DescargarFormulario from "./DescargarFormulario";

function formatKg(valor: number) {
  return valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function TanquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const tanque = await prisma.tanque.findFirst({
    where: { id, empresaId },
    include: {
      insumo: { select: { id: true, codigo: true, nombre: true } },
      almacen: { select: { nombre: true } },
      aportes: {
        include: {
          recepcionCompraDetalle: {
            select: {
              id: true,
              numeroLoteProveedor: true,
              recepcion: { select: { numero: true, fecha: true } },
            },
          },
        },
        orderBy: { ingresadoEn: "asc" },
      },
    },
  });
  if (!tanque) notFound();

  // La composición se calcula desde los aportes vigentes: es lo que hace útil
  // el modelo el día de un reclamo — no solo qué lotes participaron sino cuánto
  // de cada uno.
  const composicion = composicionTanque(
    tanque.aportes.map((a) => ({
      recepcionCompraDetalleId: a.recepcionCompraDetalleId,
      cantidadKg: a.cantidadKg.toNumber(),
    }))
  );
  const porDetalle = new Map(tanque.aportes.map((a) => [a.recepcionCompraDetalleId, a]));

  const disponibles = await prisma.recepcionCompraDetalle.findMany({
    where: {
      insumoId: tanque.insumo.id,
      cantidadDisponible: { gt: 0 },
      recepcion: { empresaId },
    },
    include: { recepcion: { select: { numero: true } } },
    orderBy: { id: "asc" },
  });

  const puedeDescargar = await puedeRealizar(usuario, "materiales", "editar");
  const contenido = tanque.contenidoKg.toNumber();
  const capacidad = tanque.capacidadKg.toNumber();
  const ocupacion = capacidad > 0 ? (contenido / capacidad) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          {tanque.codigo} — {tanque.nombre}
        </h1>
        <BotonImprimir />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <dt style={{ color: "var(--epicor-texto-tenue)" }}>Almacén</dt>
          <dd className="font-medium">{tanque.almacen.nombre}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--epicor-texto-tenue)" }}>Contiene</dt>
          <dd className="font-medium">
            {tanque.insumo.codigo} — {tanque.insumo.nombre}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--epicor-texto-tenue)" }}>Contenido</dt>
          <dd className="font-medium">{formatKg(contenido)} kg</dd>
        </div>
        <div>
          <dt style={{ color: "var(--epicor-texto-tenue)" }}>Ocupación</dt>
          <dd className="font-medium">
            {ocupacion.toFixed(1)} % de {formatKg(capacidad)} kg
          </dd>
        </div>
      </dl>

      <section className="borde-seccion mb-6">
        <h2 className="text-lg font-semibold mb-1">Composición actual</h2>
        <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
          Con qué proporción participa cada recepción en lo que hay ahora. Un consumo hacia
          producción se reparte con estos porcentajes, así que la trazabilidad dice cuánto aportó
          cada lote en vez de señalar uno solo.
        </p>

        {composicion.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            El tanque está vacío.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Recepción</th>
                  <th>Lote del proveedor</th>
                  <th className="text-right">Ingresó (kg)</th>
                  <th className="text-right">Queda (kg)</th>
                  <th className="text-right">% de la mezcla</th>
                </tr>
              </thead>
              <tbody>
                {composicion.map((c) => {
                  const aporte = porDetalle.get(c.recepcionCompraDetalleId);
                  return (
                    <tr key={c.recepcionCompraDetalleId}>
                      <td className="font-mono">
                        {aporte?.recepcionCompraDetalle.recepcion.numero ?? "—"}
                      </td>
                      <td>{aporte?.recepcionCompraDetalle.numeroLoteProveedor ?? "sin lote"}</td>
                      <td className="text-right">
                        {formatKg(aporte?.cantidadInicialKg.toNumber() ?? 0)}
                      </td>
                      <td className="text-right">{formatKg(c.cantidadKg)}</td>
                      <td className="text-right font-medium">{c.porcentaje.toFixed(2)} %</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {puedeDescargar && (
        <section className="borde-seccion">
          <h2 className="text-lg font-semibold mb-3">Descargar una recepción</h2>
          <DescargarFormulario
            accion={descargarRecepcion.bind(null, tanque.id)}
            recepciones={disponibles.map((d) => ({
              id: d.id,
              disponibleKg: d.cantidadDisponible.toNumber(),
              etiqueta: `${d.recepcion.numero} · lote ${d.numeroLoteProveedor ?? "sin número"} · ${formatKg(
                d.cantidadDisponible.toNumber()
              )} kg disponibles`,
            }))}
          />
        </section>
      )}
    </div>
  );
}
