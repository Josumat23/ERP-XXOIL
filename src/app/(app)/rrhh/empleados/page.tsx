import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const ETIQUETA_CONTRATO: Record<string, string> = {
  PLAZO_FIJO: "Plazo fijo",
  PLAZO_INDETERMINADO: "Plazo indeterminado",
  LOCACION_SERVICIOS: "Locación de servicios",
};

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");

  const { q, estado } = await searchParams;

  const empleados = await prisma.empleado.findMany({
    where: {
      ...(estado === "activo" ? { estado: "ACTIVO" } : estado === "cesado" ? { estado: "CESADO" } : {}),
      ...(q
        ? {
            OR: [
              { nombres: { contains: q } },
              { apellidos: { contains: q } },
              { codigo: { contains: q } },
              { cargo: { contains: q } },
            ],
          }
        : {}),
    },
    include: { almacen: true, centroCosto: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Empleados
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Ficha de personal, vacaciones y datos para el cálculo de planilla (Recursos Humanos →
            Planilla).
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/rrhh/vacaciones" className="boton-secundario">
            Solicitudes de vacaciones
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre, código o cargo...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="cesado">Cesados</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/rrhh/empleados/nuevo"
        nuevoTexto="Nuevo empleado"
        registros={empleados.map((e) => ({
          id: e.id,
          href: `/rrhh/empleados/${e.id}`,
          primario: `${e.nombres} ${e.apellidos}`,
          secundario: e.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Cargo</th>
            <th>Área</th>
            <th>Contrato</th>
            <th className="text-right">Sueldo básico</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((e) => (
            <tr key={e.id}>
              <td className="font-mono text-xs">
                <Link href={`/rrhh/empleados/${e.id}`} className="hover:underline">
                  {e.codigo}
                </Link>
              </td>
              <td>{e.nombres} {e.apellidos}</td>
              <td>{e.cargo}</td>
              <td>{e.area}</td>
              <td className="text-sm text-neutral-500">{ETIQUETA_CONTRATO[e.tipoContrato]}</td>
              <td className="text-right">{formatMoneda(e.sueldoBasico)}</td>
              <td>
                <span
                  className={`insignia ${
                    e.estado === "ACTIVO"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {e.estado === "ACTIVO" ? "Activo" : "Cesado"}
                </span>
              </td>
            </tr>
          ))}
          {empleados.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay empleados registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
