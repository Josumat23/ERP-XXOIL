import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import ParametroFormulario from "./ParametroFormulario";
import TasaAfpFormulario from "./TasaAfpFormulario";
import PoliticaTiempoFormulario from "./PoliticaTiempoFormulario";
import { aprobarPoliticaTiempo } from "./actions";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

const ETIQUETA_AFP: Record<string, string> = {
  INTEGRA: "Integra",
  PRIMA: "Prima",
  HABITAT: "Habitat",
  PROFUTURO: "Profuturo",
};

export default async function ParametrosPlanillaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const [parametros, tasasAfp, politicasTiempo] = await Promise.all([
    prisma.parametroPlanilla.findMany({ orderBy: { vigenteDesde: "desc" } }),
    prisma.tasaAfp.findMany({ orderBy: [{ afp: "asc" }, { vigenteDesde: "desc" }] }),
    prisma.politicaTiempoTrabajo.findMany({ where: { empresaId }, orderBy: { vigenteDesde: "desc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/rrhh/planilla" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
            ← Volver a planilla
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
            Parámetros de planilla
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            RMV, UIT, tasas de EsSalud/ONP y comisiones de AFP — versionados por fecha de vigencia,
            para que un cambio de norma no altere el cálculo de un período ya cerrado. Ver{" "}
            <code className="text-xs">docs/gobernanza/04-hcm-nomina-investigacion-normativa.md</code>{" "}
            para las fuentes.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <section className="mb-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">RMV, UIT, EsSalud, ONP</h2>
        <ParametroFormulario />
        <table className="tabla mt-4">
          <thead>
            <tr>
              <th>Vigente desde</th>
              <th className="text-right">RMV</th>
              <th className="text-right">UIT</th>
              <th className="text-right">EsSalud</th>
              <th className="text-right">ONP</th>
              <th>Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {parametros.map((p) => (
              <tr key={p.id}>
                <td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(p.vigenteDesde)}</td>
                <td className="text-right">{formatMoneda(p.rmv)}</td>
                <td className="text-right">{formatMoneda(p.uit)}</td>
                <td className="text-right">{p.tasaEsSalud.toString()}%</td>
                <td className="text-right">{p.tasaOnp.toString()}%</td>
                <td className="text-sm text-neutral-500">{p.usuarioNombre}</td>
              </tr>
            ))}
            {parametros.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-6">
                  Sin parámetros registrados — la planilla no se puede calcular hasta cargar al menos uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Tasas de AFP</h2>
        <TasaAfpFormulario />
        <table className="tabla mt-4">
          <thead>
            <tr>
              <th>AFP</th>
              <th>Comisión</th>
              <th className="text-right">Aporte</th>
              <th className="text-right">Comisión</th>
              <th className="text-right">Prima seguro</th>
              <th>Vigente desde</th>
            </tr>
          </thead>
          <tbody>
            {tasasAfp.map((t) => (
              <tr key={t.id}>
                <td>{ETIQUETA_AFP[t.afp]}</td>
                <td>{t.tipoComision === "FLUJO" ? "Flujo" : "Mixta"}</td>
                <td className="text-right">{t.tasaAporteObligatorio.toString()}%</td>
                <td className="text-right">{t.tasaComision.toString()}%</td>
                <td className="text-right">{t.primaSeguro.toString()}%</td>
                <td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(t.vigenteDesde)}</td>
              </tr>
            ))}
            {tasasAfp.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-6">
                  Sin tasas de AFP registradas — los trabajadores afiliados a AFP quedarán excluidos de
                  la corrida hasta cargar la tasa de su AFP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-neutral-900 dark:text-neutral-100">Política de jornada y sobretiempo</h2>
        <p className="mb-3 text-sm text-neutral-500">Versionada y sujeta a doble control. El creador no puede aprobar su propio borrador; solo las versiones aprobadas podrán utilizarse en planilla.</p>
        <PoliticaTiempoFormulario />
        <table className="tabla mt-4"><thead><tr><th>Vigencia</th><th>Jornada</th><th>Tramo inicial</th><th>Recargos</th><th>Aplicación</th><th>Estado</th><th></th></tr></thead><tbody>{politicasTiempo.map((politica) => <tr key={politica.id}><td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(politica.vigenteDesde)}</td><td>{politica.horasJornadaDiaria.toString()} h</td><td>{politica.primerasHorasRecargo.toString()} h</td><td>{politica.recargoPrimerTramo.toString()}% / {politica.recargoSegundoTramo.toString()}%</td><td>{politica.aplicarPagoSobretiempo ? "Planilla" : "Solo informativa"}</td><td>{politica.estado === "APROBADA" ? "Aprobada" : politica.estado === "RETIRADA" ? "Retirada" : "Borrador"}</td><td>{politica.estado === "BORRADOR" && politica.usuarioId !== usuario.id && <form action={aprobarPoliticaTiempo.bind(null, politica.id)}><button className="boton-secundario">Aprobar</button></form>}</td></tr>)}{politicasTiempo.length === 0 && <tr><td colSpan={7} className="py-5 text-center text-neutral-500">Sin políticas registradas.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}
