import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import HojaRutaFormulario from "../HojaRutaFormulario";

export default async function NuevaHojaRutaPage() {
  const [vendedores, clientes, hojas] = await Promise.all([
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({
      where: { activo: true },
      include: { zona: true },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.hojaRuta.findMany({ include: { vendedor: true }, orderBy: { fecha: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/comercial/hojas-ruta" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a hojas de ruta
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva hoja de ruta
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/hojas-ruta/nueva"
        nuevoTexto="Nueva hoja de ruta"
        registros={hojas.map((h) => ({
          id: h.id,
          href: `/comercial/hojas-ruta/${h.id}`,
          primario: h.numero,
          secundario: h.vendedor.nombre,
        }))}
      >
      <div className="max-w-3xl">
        <HojaRutaFormulario
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: c.zona ? `${c.razonSocial} (${c.zona.nombre})` : c.razonSocial,
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
