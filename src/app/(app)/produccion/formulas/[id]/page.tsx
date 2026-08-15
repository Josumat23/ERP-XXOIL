import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { alternarActivoFormula } from "../actions";

export default async function DetalleFormulaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [formula, formulas] = await Promise.all([
    prisma.formula.findUnique({
      where: { id },
      include: {
        producto: true,
        detalles: { include: { insumo: true } },
        lotes: { orderBy: { fechaInicio: "desc" }, take: 20 },
      },
    }),
    prisma.formula.findMany({
      include: { producto: true },
      orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
    }),
  ]);
  if (!formula) notFound();

  return (
    <div>
      <Link href="/produccion/formulas" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a fórmulas
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/formulas/nueva"
        nuevoTexto="Nueva versión"
        registros={formulas.map((f) => ({
          id: f.id,
          href: `/produccion/formulas/${f.id}`,
          primario: f.producto.nombre,
          secundario: `v${f.version}`,
        }))}
      >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            {formula.producto.nombre} — versión {formula.version}
          </h1>
          <span
            className={`insignia ${
              formula.activo
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
            }`}
          >
            {formula.activo ? "Activa" : "Inactiva"}
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          Batch de {formatNumero(formula.rendimientoKg, 2)} kg de granel · Creada por{" "}
          {formula.usuarioNombre} el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(formula.creadoEn)}
          {formula.notas ? ` · ${formula.notas}` : ""}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          {formula.vigenteDesde
            ? `Vigente desde ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(formula.vigenteDesde)}${
                formula.vigenteHasta
                  ? ` hasta ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(formula.vigenteHasta)}`
                  : " (vigente actualmente)"
              }`
            : "Nunca estuvo vigente"}
        </p>

        <table className="tabla mt-4">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="text-right">Cantidad por batch</th>
            </tr>
          </thead>
          <tbody>
            {formula.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.insumo.nombre}{" "}
                  <span className="text-xs text-neutral-400 font-mono">{d.insumo.codigo}</span>
                </td>
                <td className="text-right">
                  {formatNumero(d.cantidad, 3)} {d.insumo.unidadMedida}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form
          className="mt-4"
          action={async () => {
            "use server";
            await alternarActivoFormula(formula.id, !formula.activo);
          }}
        >
          <button type="submit" className="boton-secundario text-sm">
            {formula.activo ? "Desactivar" : "Activar"}
          </button>
        </form>
        {!formula.activo && (
          <p className="text-xs mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            Al activar esta versión se desactiva automáticamente la versión vigente actual de{" "}
            {formula.producto.nombre}.
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-medium" style={{ color: "var(--epicor-texto)" }}>
            Órdenes de producción con esta fórmula
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>N.° de orden</th>
                <th className="text-right">Kg objetivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {formula.lotes.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/produccion/lotes/${l.id}`} className="hover:underline">
                      {l.codigo}
                    </Link>
                  </td>
                  <td className="text-right">{formatNumero(l.kgObjetivo, 2)}</td>
                  <td className="text-sm">{l.estado}</td>
                </tr>
              ))}
              {formula.lotes.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-500 py-4">
                    Aún no se ha producido ninguna orden con esta versión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
