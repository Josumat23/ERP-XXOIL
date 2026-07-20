import { prisma } from "@/lib/prisma";

// Lista de unidades de medida activas para los <select> de Producto/Insumo.
export async function unidadesMedidaParaSelect() {
  const unidades = await prisma.unidadMedida.findMany({
    where: { activo: true, clase: { activo: true } },
    orderBy: [{ clase: { codigo: "asc" } }, { codigo: "asc" }],
  });
  return unidades.map((u) => ({ codigo: u.codigo, nombre: u.nombre }));
}
