import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { formatFecha } from "@/lib/format";
import { NuevaConciliacionFormulario } from "./FormulariosConciliacion";

export default async function ConciliacionBancariaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const [cuentas, conciliaciones, puedeCrear] = await Promise.all([
    prisma.cuentaBancariaEmpresa.findMany({ where: { empresaId, activo: true }, orderBy: [{ banco: "asc" }, { moneda: "asc" }] }),
    prisma.conciliacionBancaria.findMany({ where: { empresaId }, include: { cuentaBancaria: true, movimientos: true }, orderBy: { fechaHasta: "desc" } }),
    puedeRealizar(usuario, "finanzas", "crear"),
  ]);
  return <div className="max-w-6xl"><div className="mb-5"><h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Conciliación bancaria</h1><p className="mt-1 text-sm text-neutral-500">Cuadre entre extractos bancarios y el libro de caja con trazabilidad por partida.</p></div>
    {puedeCrear && <NuevaConciliacionFormulario cuentas={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.banco} · ${c.moneda} · ${c.numeroCuenta}` }))} />}
    <div className="mt-6 overflow-x-auto"><table className="tabla"><thead><tr><th>Cuenta</th><th>Período</th><th>Estado</th><th>Partidas</th><th className="text-right">Saldo extracto</th></tr></thead><tbody>{conciliaciones.map((c) => <tr key={c.id}><td><Link href={`/finanzas/conciliacion-bancaria/${c.id}`} className="font-medium hover:underline">{c.cuentaBancaria.banco + " · " + c.cuentaBancaria.numeroCuenta}</Link></td><td>{formatFecha(c.fechaDesde) + " — " + formatFecha(c.fechaHasta)}</td><td><span className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{c.estado === "CERRADA" ? "Cerrada" : c.estado === "ANULADA" ? "Anulada" : "Borrador"}</span></td><td>{c.movimientos.length}</td><td className="text-right">{new Intl.NumberFormat("es-PE", { style: "currency", currency: c.cuentaBancaria.moneda }).format(c.saldoFinalExtracto.toNumber())}</td></tr>)}{conciliaciones.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-neutral-500">No hay conciliaciones registradas.</td></tr>}</tbody></table></div>
  </div>;
}