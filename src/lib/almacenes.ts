import { prisma } from "@/lib/prisma";

// Lista de zonas activas para los <select> de ubicación en Presentación/Insumo.
export async function zonasAlmacenParaSelect() {
  const zonas = await prisma.zonaAlmacen.findMany({
    where: { activo: true, almacen: { activo: true } },
    include: { almacen: true },
    orderBy: [{ almacen: { codigo: "asc" } }, { codigo: "asc" }],
  });
  return zonas.map((z) => ({
    id: z.id,
    etiqueta: `${z.almacen.nombre} — ${z.codigo}${z.nombre ? ` (${z.nombre})` : ""}`,
  }));
}
