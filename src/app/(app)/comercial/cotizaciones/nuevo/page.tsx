import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CotizacionFormulario from "../CotizacionFormulario";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ presentacion?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const { presentacion: presentacionPedida } = await searchParams;

  const [clientes, vendedores, presentaciones, cotizaciones, descuentosCanal] = await Promise.all([
    prisma.cliente.findMany({ where: { empresaId, estado: "ACTIVO" }, orderBy: { razonSocial: "asc" } }),
    prisma.vendedor.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.presentacion.findMany({
      where: { empresaId, activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.cotizacion.findMany({ where: { empresaId }, include: { cliente: true }, orderBy: { fecha: "desc" } }),
    prisma.descuentoCanal.findMany({ where: { empresaId } }),
  ]);

  // Solo se precarga una presentación que exista y esté activa: el id viene
  // de la URL y no se confía en él.
  const presentacionInicial =
    presentacionPedida && presentaciones.some((p) => p.id === presentacionPedida)
      ? presentacionPedida
      : null;
  const descuentoPorCanal = Object.fromEntries(
    descuentosCanal.map((d) => [d.canal, d.descuentoPct.toNumber()])
  );

  return (
    <div>
      <Link href="/comercial/cotizaciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a cotizaciones
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva cotización
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/cotizaciones/nuevo"
        nuevoTexto="Nueva cotización"
        registros={cotizaciones.map((c) => ({
          id: c.id,
          href: `/comercial/cotizaciones/${c.id}`,
          primario: c.numero,
          secundario: c.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        {/*
          El buscador vive en su propia pantalla: es un GET, y tenerlo acá
          adentro haría que buscar borrara lo que ya se escribió.
        */}
        <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
          ¿El cliente pide un producto de la competencia?{" "}
          <Link href="/comercial/equivalentes" className="hover:underline">
            Buscar equivalente
          </Link>
          .
        </p>
        <CotizacionFormulario
          key={presentacionInicial ?? "vacio"}
          presentacionInicial={presentacionInicial}
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: c.razonSocial,
            vendedorId: c.vendedorId,
            canal: c.canal,
          }))}
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          descuentoPorCanal={descuentoPorCanal}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.producto.nombre} — ${p.nombre}`,
            precio: p.precio.toNumber(),
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
