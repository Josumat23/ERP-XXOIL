import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { coberturaEspecificaciones } from "@/lib/equivalencias";
import { etiquetaEspecificacion } from "@/lib/especificaciones";
import { disponibleParaPrometer, ordenarSugerencias } from "@/lib/sugerenciaEquivalente";
import PanelEquivalente from "./PanelEquivalente";

/**
 * «¿Tienen algo equivalente al Delvac 1340?»
 *
 * Vive en su propia pantalla y no dentro del formulario de cotización por una
 * razón concreta: la búsqueda es un GET, y meterla adentro del formulario haría
 * que buscar borrara lo que el vendedor ya hubiera escrito. Además la pregunta
 * llega muchas veces por teléfono, sin que haya todavía una cotización.
 */
export default async function EquivalentesPage({
  searchParams,
}: {
  searchParams: Promise<{ equivalenteA?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const { equivalenteA } = await searchParams;

  const competidores = await prisma.productoCompetencia.findMany({
    where: { empresaId, activo: true },
    orderBy: [{ marca: "asc" }, { nombre: "asc" }],
  });

  // El id llega por la URL: se lee filtrando por la compañía activa como
  // cualquier otro dato que venga del navegador.
  const elegido = equivalenteA
    ? await prisma.productoCompetencia.findFirst({
        where: { id: equivalenteA, empresaId },
        include: {
          especificaciones: { include: { especificacion: true } },
          equivalencias: {
            include: {
              producto: {
                include: {
                  especificaciones: {
                    select: { especificacionId: true, tipo: true, vigenteHasta: true },
                  },
                  presentaciones: { where: { activo: true }, orderBy: { sku: "asc" } },
                },
              },
            },
          },
        },
      })
    : null;

  const suyas = elegido?.especificaciones.map((e) => ({ especificacionId: e.especificacionId })) ?? [];
  const faltantesPorId = new Map(
    (elegido?.especificaciones ?? []).map((e) => [
      e.especificacionId,
      etiquetaEspecificacion(e.especificacion),
    ])
  );

  // La cobertura se recalcula acá: es la de hoy. Una homologación vencida tiene
  // que verse en el momento de ofrecer, no solo en la ficha del competidor.
  const sugerencias = ordenarSugerencias(
    (elegido?.equivalencias ?? []).map((eq) => ({
      productoId: eq.productoId,
      codigo: eq.producto.codigo,
      nombre: eq.producto.nombre,
      cobertura: coberturaEspecificaciones(eq.producto.especificaciones, suyas),
      justificacion: eq.justificacion,
      presentaciones: eq.producto.presentaciones.map((p) => ({
        presentacionId: p.id,
        sku: p.sku,
        nombre: p.nombre,
        precio: p.precio.toNumber(),
        moneda: p.moneda,
        disponible: disponibleParaPrometer({
          stock: p.stock.toNumber(),
          stockReservado: p.stockReservado.toNumber(),
        }),
      })),
    }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Buscar equivalente
        </h1>
        <BotonImprimir />
      </div>

      <div className="max-w-4xl">
        <PanelEquivalente
          competidores={competidores.map((c) => ({
            id: c.id,
            etiqueta: `${c.marca} ${c.nombre}`,
          }))}
          elegidoId={elegido?.id ?? null}
          nombreElegido={elegido ? `${elegido.marca} ${elegido.nombre}` : null}
          fuente={elegido?.fuente ?? null}
          sugerencias={sugerencias}
          faltantesPorId={faltantesPorId}
        />
      </div>
    </div>
  );
}
