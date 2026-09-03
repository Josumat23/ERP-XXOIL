import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import BarraFiltro from "@/components/BarraFiltro";
import CalidadFormulario from "./CalidadFormulario";

export default async function CalidadPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resultado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { q, resultado } = await searchParams;
  const filtroResultado = resultado === "APROBADO" || resultado === "RECHAZADO" ? resultado : undefined;

  const [pendientes, evaluados, causas, planes] = await Promise.all([
    prisma.loteGranel.findMany({
      where: { estado: "PENDIENTE_CALIDAD" },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaFin: "asc" },
    }),
    prisma.controlCalidad.findMany({
      where: {
        ...(filtroResultado ? { resultado: filtroResultado } : {}),
        ...(q ? { loteGranel: { OR: [{ codigo: { contains: q } }, { formula: { producto: { nombre: { contains: q } } } }] } } : {}),
      },
      include: { loteGranel: { include: { formula: { include: { producto: true } } } }, causa: true, resultadosCaracteristica: { orderBy: { secuencia: "asc" } } },
      orderBy: { fecha: "desc" },
      take: 20,
    }),
    prisma.causaCalidad.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.planInspeccionCalidad.findMany({ where: { empresaId: usuario.empresaId, activo: true }, include: { caracteristicas: { orderBy: { secuencia: "asc" } } } }),
  ]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Control de calidad
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Ningún lote granel puede envasarse sin aprobación de calidad.
      </p>
      <div className="flex gap-4 mt-2 text-sm">
        <Link href="/produccion/calidad/causas" className="hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          Catálogo de causas de calidad
        </Link>
        <Link href="/produccion/calidad/planes" className="hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          Planes de inspección
        </Link>
        <Link href="/produccion/calidad/no-conformidades" className="hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          No conformidades / CAPA
        </Link>
        <Link href="/produccion/calidad/reclamos" className="hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          Reclamos de cliente
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Lotes pendientes</h2>
        <div className="mt-3 flex flex-col gap-4">
          {pendientes.map((l) => (
            <div key={l.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">
                  <Link href={`/produccion/lotes/${l.id}`} className="hover:underline">
                    {l.codigo}
                  </Link>{" "}
                  — {l.formula.producto.nombre} v{l.formula.version}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatNumero(l.kgProducidos, 2)} kg producidos · merma{" "}
                  {formatNumero(l.mermaKg, 2)} kg
                </p>
              </div>
              <CalidadFormulario loteId={l.id} causas={causas} plan={planes.find(p => p.productoId === l.formula.productoId) ?? null} />
            </div>
          ))}
          {pendientes.length === 0 && (
            <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
              No hay lotes pendientes de evaluación.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Últimas evaluaciones</h2>
        <BarraFiltro q={q} placeholder="Código de lote o producto...">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
            <select name="resultado" defaultValue={filtroResultado ?? ""} className="campo-input">
              <option value="">Todos</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
          </label>
        </BarraFiltro>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Producto</th>
              <th>Resultado</th>
              <th>Mediciones</th>
              <th>Observaciones</th>
              <th>Causa raíz / acción correctiva</th>
              <th>Evaluador</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {evaluados.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">
                  <Link href={`/produccion/lotes/${c.loteGranelId}`} className="hover:underline">
                    {c.loteGranel.codigo}
                  </Link>
                  {c.resultado === "APROBADO" && c.resultadosCaracteristica.length > 0 && <Link href={`/produccion/calidad/certificados/${c.loteGranelId}`} className="block mt-1 text-blue-700 hover:underline">Certificado</Link>}
                </td>
                <td>{c.loteGranel.formula.producto.nombre}</td>
                <td>
                  <span
                    className={`insignia ${
                      c.resultado === "APROBADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {c.resultado === "APROBADO" ? "Aprobado" : "Rechazado"}
                  </span>
                </td>
                <td className="text-xs min-w-52">
                  {c.resultadosCaracteristica.length > 0 ? c.resultadosCaracteristica.map(r => (
                    <span key={r.id} className={`block ${r.conforme ? "text-green-700" : "text-red-600 font-medium"}`}>
                      {r.nombre}: {r.valorMedido.toString()} {r.unidadMedida} {r.conforme ? "✓" : "Fuera de especificación"}
                    </span>
                  )) : "Evaluación heredada"}
                </td>
                <td className="text-sm text-neutral-500 max-w-56">{c.observaciones ?? "—"}</td>
                <td className="text-xs text-neutral-500 max-w-64">
                  {c.causa || c.causaRaiz || c.accionCorrectiva ? (
                    <>
                      {c.causa && <span className="block">Causa: {c.causa.nombre}</span>}
                      {c.causaRaiz && <span className="block">Detalle: {c.causaRaiz}</span>}
                      {c.accionCorrectiva && <span className="block">Acción: {c.accionCorrectiva}</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-sm">{c.usuarioNombre}</td>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                    c.fecha
                  )}
                </td>
              </tr>
            ))}
            {evaluados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-neutral-500 py-4">
                  Sin evaluaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
