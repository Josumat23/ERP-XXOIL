import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { ResultadoInspeccion } from "@/generated/prisma/client";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { contiene } from "@/lib/busqueda";
import {
  EXPLICACION_NIVEL_RECEPCION,
  MENSAJE_NIVEL_CONTROL,
  NIVELES_CONTROL,
} from "@/lib/calibracion";
import { fijarNivelInspeccionRecepcion } from "./actions";

const ETIQUETA_RESULTADO: Record<ResultadoInspeccion, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

const COLOR_RESULTADO: Record<ResultadoInspeccion, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

const RESULTADOS = Object.values(ResultadoInspeccion);

export default async function InspeccionesCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resultado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { q, resultado } = await searchParams;
  const filtroResultado = RESULTADOS.find((r) => r === resultado);
  const empresaId = await obtenerEmpresaActivaId();

  const configuracion = await prisma.configuracionEmpresa.findUnique({
    where: { empresaId },
    select: { nivelInspeccionRecepcion: true },
  });
  const nivelRecepcion = configuracion?.nivelInspeccionRecepcion ?? "ADVIERTE";

  const inspecciones = await prisma.inspeccionCompra.findMany({
    where: {
      recepcionDetalle: { recepcion: { ordenCompra: { empresaId } }, ...(q ? { insumo: { nombre: contiene(q) } } : {}) },
      ...(filtroResultado ? { resultado: filtroResultado } : {}),
    },
    include: {
      recepcionDetalle: {
        include: {
          insumo: true,
          recepcion: { include: { ordenCompra: { include: { proveedor: true } } } },
        },
      },
    },
    orderBy: [{ resultado: "asc" }, { creadoEn: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Inspección de calidad de compras
        </h1>
        <Link href="/logistica/inspeccion-compras/planes" className="boton-secundario">Planes de inspección</Link>
      </div>

      <PanelMaestroDetalle
        registros={inspecciones.map((i) => ({
          id: i.id,
          href: `/logistica/inspeccion-compras/${i.id}`,
          primario: i.recepcionDetalle.insumo.nombre,
          secundario: `${ETIQUETA_RESULTADO[i.resultado]} · Recepción ${i.recepcionDetalle.recepcion.numero}`,
        }))}
      >
        <div className="max-w-3xl">
          {/*
            Tres niveles, como el control de calibración. Nace en ADVIERTE por
            decisión del negocio: todo insumo se compra y puede ir directo a
            producción, pase o no por laboratorio. Retener el material es el
            bloqueo más caro del sistema y solo se justifica si alguien lo pide.
          */}
          <section className="borde-seccion mb-5">
            <h2 className="font-medium">Qué hace la inspección con el material</h2>
            <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
              En cualquier nivel se registra la inspección: lo que cambia es si el material espera
              o no. Qué insumos se inspeccionan se marca en cada insumo, no acá.
            </p>
            <div className="flex flex-col gap-2">
              {NIVELES_CONTROL.map((opcion) => (
                <form
                  key={opcion}
                  action={async () => {
                    "use server";
                    await fijarNivelInspeccionRecepcion(opcion);
                  }}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                    opcion === nivelRecepcion
                      ? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800"
                      : "border-black/10 dark:border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {MENSAJE_NIVEL_CONTROL[opcion]}
                      {opcion === nivelRecepcion && (
                        <span className="insignia ml-2 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Vigente
                        </span>
                      )}
                    </p>
                    <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
                      {EXPLICACION_NIVEL_RECEPCION[opcion]}
                    </p>
                  </div>
                  {opcion !== nivelRecepcion && (
                    <button type="submit" className="boton-secundario shrink-0">
                      Usar este
                    </button>
                  )}
                </form>
              ))}
            </div>
          </section>
          <BarraFiltro q={q} placeholder="Insumo...">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
              <select name="resultado" defaultValue={filtroResultado ?? ""} className="campo-input">
                <option value="">Todos</option>
                {RESULTADOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RESULTADO[r]}
                  </option>
                ))}
              </select>
            </label>
          </BarraFiltro>
          <table className="tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Proveedor</th>
                <th>Recepción</th>
                <th className="text-right">Cantidad</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {inspecciones.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/logistica/inspeccion-compras/${i.id}`} className="hover:underline">
                      {i.recepcionDetalle.insumo.nombre}
                    </Link>
                  </td>
                  <td>{i.recepcionDetalle.recepcion.ordenCompra.proveedor.razonSocial}</td>
                  <td className="font-mono text-xs">{i.recepcionDetalle.recepcion.numero}</td>
                  <td className="text-right">
                    {formatNumero(i.recepcionDetalle.cantidad, 3)} {i.recepcionDetalle.insumo.unidadMedida}
                  </td>
                  <td>
                    <span className={`insignia ${COLOR_RESULTADO[i.resultado]}`}>
                      {ETIQUETA_RESULTADO[i.resultado]}
                    </span>
                  </td>
                </tr>
              ))}
              {inspecciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin recepciones pendientes de inspección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
