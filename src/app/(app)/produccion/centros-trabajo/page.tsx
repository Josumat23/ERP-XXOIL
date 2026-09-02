import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { capacidadEfectivaDiaria } from "@/lib/centrosTrabajo";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

const ETIQUETA = { MEZCLA: "Mezcla / cocción", ENVASADO: "Envasado", CALIDAD: "Calidad", MANTENIMIENTO: "Mantenimiento", OTRO: "Otro" } as const;

export default async function CentrosTrabajoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const centros = await prisma.centroTrabajo.findMany({
    include: { almacen: true, centroCosto: true, _count: { select: { equipos: true } } },
    orderBy: [{ activo: "desc" }, { codigo: "asc" }],
  });
  return <div className="max-w-6xl">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Centros de trabajo</h1><p className="text-sm text-neutral-500 mt-1">Capacidad operativa por línea, planta y centro de costo.</p></div>
      <div className="flex gap-2 no-imprimir"><BotonImprimir /><Link href="/produccion/centros-trabajo/nuevo" className="boton-primario">Nuevo centro</Link></div>
    </div>
    <table className="tabla mt-6"><thead><tr><th>Código</th><th>Centro de trabajo</th><th>Tipo</th><th>Planta</th><th>Centro de costo</th><th className="text-right">Capacidad efectiva</th><th className="text-right">Equipos</th><th>Estado</th></tr></thead>
      <tbody>{centros.map((c) => <tr key={c.id}><td><Link href={`/produccion/centros-trabajo/${c.id}`} className="font-mono text-xs hover:underline">{c.codigo}</Link></td><td>{c.nombre}</td><td>{ETIQUETA[c.tipo]}</td><td>{c.almacen.nombre}</td><td>{c.centroCosto ? `${c.centroCosto.codigo} — ${c.centroCosto.nombre}` : "—"}</td><td className="text-right">{formatNumero(capacidadEfectivaDiaria(c.capacidadHorasDia.toNumber(), c.eficienciaPct.toNumber()), 2)} h/día</td><td className="text-right">{c._count.equipos}</td><td><span className={`insignia ${c.activo ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"}`}>{c.activo ? "Activo" : "Inactivo"}</span></td></tr>)}
      {centros.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-neutral-500">Aún no hay centros de trabajo configurados.</td></tr>}</tbody></table>
  </div>;
}
