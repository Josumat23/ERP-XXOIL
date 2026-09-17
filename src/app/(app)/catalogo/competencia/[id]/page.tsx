import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { etiquetaEspecificacion } from "@/lib/especificaciones";
import { cambioDeCobertura, coberturaEspecificaciones } from "@/lib/equivalencias";
import BotonImprimir from "@/components/BotonImprimir";
import EspecificacionCompetenciaFormulario from "./EspecificacionCompetenciaFormulario";
import EquivalenciaFormulario from "./EquivalenciaFormulario";
import {
  agregarEspecificacionCompetencia,
  declararEquivalencia,
  quitarEquivalencia,
  quitarEspecificacionCompetencia,
} from "../actions";

export default async function ProductoCompetenciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();

  const competidor = await prisma.productoCompetencia.findFirst({
    where: { id, empresaId },
    include: {
      especificaciones: {
        include: { especificacion: true },
        orderBy: [{ especificacion: { organismo: "asc" } }, { especificacion: { codigo: "asc" } }],
      },
      equivalencias: {
        include: {
          producto: {
            include: {
              especificaciones: {
                select: { especificacionId: true, tipo: true, vigenteHasta: true },
              },
            },
          },
        },
        orderBy: { creadoEn: "asc" },
      },
    },
  });
  if (!competidor) notFound();

  const [especificacionesActivas, productos] = await Promise.all([
    prisma.especificacionTecnica.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ organismo: "asc" }, { codigo: "asc" }],
    }),
    prisma.producto.findMany({
      where: { empresaId, activo: true },
      include: {
        especificaciones: { select: { especificacionId: true, tipo: true, vigenteHasta: true } },
      },
      orderBy: { codigo: "asc" },
    }),
  ]);

  const suyas = competidor.especificaciones.map((e) => ({ especificacionId: e.especificacionId }));
  const nombrePorId = new Map(
    competidor.especificaciones.map((e) => [e.especificacionId, etiquetaEspecificacion(e.especificacion)])
  );

  // La cobertura de HOY, que no es la de cuando se declaró: una homologación
  // nuestra que venció deja de contar sin que nadie toque la equivalencia.
  const declaradas = competidor.equivalencias.map((eq) => {
    const cobertura = coberturaEspecificaciones(eq.producto.especificaciones, suyas);
    return {
      ...eq,
      cobertura,
      cambio: cambioDeCobertura(
        { cubiertas: eq.cubiertasAlDeclarar, total: eq.totalAlDeclarar },
        { cubiertas: cobertura.cubiertas.length, total: cobertura.total }
      ),
    };
  });

  const yaDeclarados = new Set(competidor.equivalencias.map((e) => e.productoId));
  const candidatos = productos
    .filter((p) => !yaDeclarados.has(p.id))
    .map((p) => {
      const cobertura = coberturaEspecificaciones(p.especificaciones, suyas);
      return {
        id: p.id,
        etiqueta: `${p.codigo} — ${p.nombre}`,
        cubiertas: cobertura.cubiertas.length,
        total: cobertura.total,
        faltantes: cobertura.faltantes.map((x) => nombrePorId.get(x) ?? x),
      };
    })
    // Los que más cubren, primero: es el orden en que alguien busca un reemplazo.
    .sort((a, b) => b.cubiertas - a.cubiertas);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/catalogo/competencia" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a competencia
        </Link>
        <BotonImprimir />
      </div>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        {competidor.marca} {competidor.nombre}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--epicor-texto-tenue)" }}>
        {competidor.fuente
          ? `Según ${competidor.fuente}`
          : "Sin fuente anotada — conviene registrar de dónde salió lo que declara."}
      </p>

      <div className="max-w-4xl">
        <section>
          <h2 className="font-medium mb-3">Lo que su ficha declara cumplir</h2>
          {competidor.especificaciones.length > 0 ? (
            <table className="tabla mb-4">
              <thead>
                <tr>
                  <th>Especificación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {competidor.especificaciones.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium">{etiquetaEspecificacion(e.especificacion)}</td>
                    <td>
                      <form
                        action={async () => {
                          "use server";
                          await quitarEspecificacionCompetencia(competidor.id, e.id);
                        }}
                      >
                        <button type="submit" className="text-sm text-red-600 hover:underline">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
              Todavía no se cargó ninguna. Sin esto no hay contra qué comparar, y no se puede
              declarar ninguna equivalencia.
            </p>
          )}
          <EspecificacionCompetenciaFormulario
            accion={agregarEspecificacionCompetencia.bind(null, competidor.id)}
            opciones={especificacionesActivas
              .filter((e) => !competidor.especificaciones.some((s) => s.especificacionId === e.id))
              .map((e) => ({ id: e.id, etiqueta: etiquetaEspecificacion(e) }))}
          />
        </section>

        <section className="mt-10">
          <h2 className="font-medium mb-3">Nuestros equivalentes</h2>
          {declaradas.length > 0 && (
            <table className="tabla mb-4">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cobertura hoy</th>
                  <th>No cubre</th>
                  <th>Motivo</th>
                  <th>Declarada por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {declaradas.map((eq) => (
                  <tr key={eq.id}>
                    <td className="font-medium">
                      <Link href={`/catalogo/productos/${eq.productoId}`} className="hover:underline">
                        {eq.producto.codigo} — {eq.producto.nombre}
                      </Link>
                    </td>
                    <td
                      className={
                        eq.cambio.sentido === "EMPEORO"
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : ""
                      }
                    >
                      {eq.cambio.texto}
                    </td>
                    <td style={{ color: "var(--epicor-texto-tenue)" }}>
                      {eq.cobertura.faltantes.length === 0
                        ? "—"
                        : eq.cobertura.faltantes
                            .map((f) => nombrePorId.get(f) ?? f)
                            .join(", ")}
                    </td>
                    <td style={{ color: "var(--epicor-texto-tenue)" }}>{eq.justificacion ?? "—"}</td>
                    <td>{eq.usuarioNombre}</td>
                    <td>
                      <form
                        action={async () => {
                          "use server";
                          await quitarEquivalencia(competidor.id, eq.id);
                        }}
                      >
                        <button type="submit" className="text-sm text-red-600 hover:underline">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <EquivalenciaFormulario
            accion={declararEquivalencia.bind(null, competidor.id)}
            candidatos={candidatos}
          />
        </section>
      </div>
    </div>
  );
}
