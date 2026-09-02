import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import CentroTrabajoFormulario from "../CentroTrabajoFormulario";
import { crearCentroTrabajo } from "../actions";

export default async function NuevoCentroTrabajoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const [almacenes, centrosCosto] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);
  return <div><Link href="/produccion/centros-trabajo" className="text-sm hover:underline">← Volver a centros de trabajo</Link><h1 className="text-2xl font-semibold mt-1 mb-5">Nuevo centro de trabajo</h1><CentroTrabajoFormulario accion={crearCentroTrabajo} almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: `${a.codigo} — ${a.nombre}` }))} centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))} /></div>;
}
