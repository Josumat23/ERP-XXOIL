import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

type EmpleadoOrganigrama = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  area: string;
  jefeDirectoId: string | null;
};

function Nodo({ empleado, hijosPorJefe, ancestros = new Set<string>() }: { empleado: EmpleadoOrganigrama; hijosPorJefe: Map<string, EmpleadoOrganigrama[]>; ancestros?: Set<string> }) {
  const hijos = hijosPorJefe.get(empleado.id) ?? [];
  const ciclo = ancestros.has(empleado.id);
  const siguientesAncestros = new Set(ancestros).add(empleado.id);
  return (
    <li>
      <Link href={`/rrhh/empleados/${empleado.id}`} className="block rounded-lg border border-black/10 bg-white p-3 shadow-sm hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900">
        <strong className="block">{empleado.nombres} {empleado.apellidos}</strong>
        <span className="block text-sm text-neutral-600 dark:text-neutral-300">{empleado.cargo}</span>
        <span className="block text-xs text-neutral-500">{empleado.codigo} · {empleado.area} · {hijos.length} reporte(s)</span>
      </Link>
      {ciclo && <p className="mt-2 text-xs text-red-600">Jerarquía inconsistente: ciclo detectado.</p>}
      {!ciclo && hijos.length > 0 && <ul className="ml-5 mt-3 grid gap-3 border-l border-black/10 pl-4 dark:border-white/10">{hijos.map((hijo) => <Nodo key={hijo.id} empleado={hijo} hijosPorJefe={hijosPorJefe} ancestros={siguientesAncestros} />)}</ul>}
    </li>
  );
}

export default async function OrganigramaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const empleados = await prisma.empleado.findMany({
    where: { empresaId, estado: "ACTIVO" },
    select: { id: true, codigo: true, nombres: true, apellidos: true, cargo: true, area: true, jefeDirectoId: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
  });
  const ids = new Set(empleados.map((empleado) => empleado.id));
  const raices = empleados.filter((empleado) => !empleado.jefeDirectoId || !ids.has(empleado.jefeDirectoId));
  const hijosPorJefe = new Map<string, EmpleadoOrganigrama[]>();
  for (const empleado of empleados) {
    if (!empleado.jefeDirectoId || !ids.has(empleado.jefeDirectoId)) continue;
    hijosPorJefe.set(empleado.jefeDirectoId, [...(hijosPorJefe.get(empleado.jefeDirectoId) ?? []), empleado]);
  }

  return <div className="max-w-5xl"><div className="mb-5"><Link href="/rrhh/empleados" className="text-sm hover:underline">← Empleados</Link><h1 className="mt-2 text-2xl font-semibold">Organigrama</h1><p className="text-sm text-neutral-500">Estructura de reporte de la compañía activa. Seleccione una persona para administrar su jefatura.</p></div>{raices.length > 0 ? <ul className="grid gap-5 md:grid-cols-2">{raices.map((raiz) => <Nodo key={raiz.id} empleado={raiz} hijosPorJefe={hijosPorJefe} />)}</ul> : <div className="tarjeta p-6 text-sm text-neutral-500">{empleados.length === 0 ? "No hay empleados activos para representar." : "La estructura no tiene un nivel raíz válido. Revise las jefaturas registradas."}</div>}</div>;
}
