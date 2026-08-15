import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BotonImprimir from "@/components/BotonImprimir";
import ReclamoEstadoFormulario from "./ReclamoEstadoFormulario";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  CERRADO: "Cerrado",
};

export default async function DetalleReclamoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [reclamo, reclamos] = await Promise.all([
    prisma.reclamoCliente.findUnique({
      where: { id },
      include: { cliente: true, factura: true, causa: true },
    }),
    prisma.reclamoCliente.findMany({ include: { cliente: true }, orderBy: { creadoEn: "desc" } }),
  ]);
  if (!reclamo) notFound();

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/produccion/calidad/reclamos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a reclamos de cliente
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={reclamos.map((r) => ({
          id: r.id,
          href: `/produccion/calidad/reclamos/${r.id}`,
          primario: r.numero,
          secundario: r.cliente.razonSocial,
        }))}
      >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            {reclamo.numero}
          </h1>
          <span
            className={`insignia ${
              reclamo.estado === "CERRADO"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : reclamo.estado === "EN_PROCESO"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
            }`}
          >
            {ETIQUETA_ESTADO[reclamo.estado]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
          <Dato etiqueta="Cliente" valor={reclamo.cliente.razonSocial} href={`/comercial/clientes/${reclamo.cliente.id}`} />
          {reclamo.factura && (
            <Dato etiqueta="Factura relacionada" valor={reclamo.factura.numero} href={`/comercial/facturas/${reclamo.factura.id}`} />
          )}
          <Dato etiqueta="Causa" valor={reclamo.causa?.nombre ?? "Sin determinar"} />
          <Dato
            etiqueta="Fecha"
            valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(reclamo.fecha)}
          />
          {reclamo.fechaCierre && (
            <Dato
              etiqueta="Fecha de cierre"
              valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(reclamo.fechaCierre)}
            />
          )}
          <Dato etiqueta="Registrado por" valor={reclamo.usuarioNombre} />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Descripción
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
            {reclamo.descripcion}
          </p>
        </div>

        {reclamo.accionCorrectiva && (
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Acción correctiva
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
              {reclamo.accionCorrectiva}
            </p>
          </div>
        )}

        <div className="mt-6 no-imprimir">
          <ReclamoEstadoFormulario
            reclamoId={reclamo.id}
            estado={reclamo.estado}
            accionCorrectivaActual={reclamo.accionCorrectiva}
          />
        </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor, href }: { etiqueta: string; valor: string; href?: string }) {
  return (
    <p>
      <span className="text-neutral-500">{etiqueta}: </span>
      {href ? (
        <Link href={href} className="font-medium hover:underline">
          {valor}
        </Link>
      ) : (
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{valor}</span>
      )}
    </p>
  );
}
