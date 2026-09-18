import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// «¿Este registro es de la compañía activa?», para los paneles genéricos.
//
// Adjuntos, contactos y direcciones se montan sobre CUALQUIER ficha con un par
// `entidadTipo` + `entidadId` que llega del navegador. Cada uno se preguntaba
// por su cuenta si esa entidad existe, y las tres respuestas se habían
// separado: comprobaban la compañía para Cliente y Proveedor, y para el resto
// —Empleado, Insumo, OrdenCompra, Equipo, ActivoFijo— solo que el id existiera.
//
// Los cinco modelos TIENEN `empresaId`. O sea que, sabiendo un id, un usuario
// de una compañía podía colgarle un adjunto al empleado de otra, borrarle una
// dirección, o descargarse el archivo adjunto de su activo fijo. No hacía
// falta ningún permiso extra: el rol se comprueba por TIPO de entidad, no por
// compañía.
//
// Acá se contesta una sola vez. La tabla de comprobaciones es un `Record`
// exhaustivo a propósito: agregar un tipo de entidad NO COMPILA hasta decir
// cómo se acota a la compañía. Un `switch` con `default` deja que el próximo
// tipo entre sin acotar, que es exactamente lo que pasó.
// ---------------------------------------------------------------------------

export const ENTIDADES_DE_LA_EMPRESA = [
  "Insumo",
  "Cliente",
  "Proveedor",
  "OrdenCompra",
  "Empleado",
  "Equipo",
  "ActivoFijo",
] as const;

export type EntidadDeLaEmpresa = (typeof ENTIDADES_DE_LA_EMPRESA)[number];

export function esEntidadDeLaEmpresa(valor: string): valor is EntidadDeLaEmpresa {
  return ENTIDADES_DE_LA_EMPRESA.some((tipo) => tipo === valor);
}

/** Cómo se comprueba cada tipo. Todos por `id` + `empresaId`, sin excepciones. */
const COMPROBACION: Record<
  EntidadDeLaEmpresa,
  (id: string, empresaId: string) => Promise<boolean>
> = {
  Insumo: async (id, empresaId) =>
    Boolean(await prisma.insumo.findFirst({ where: { id, empresaId }, select: { id: true } })),
  Cliente: async (id, empresaId) =>
    Boolean(await prisma.cliente.findFirst({ where: { id, empresaId }, select: { id: true } })),
  Proveedor: async (id, empresaId) =>
    Boolean(await prisma.proveedor.findFirst({ where: { id, empresaId }, select: { id: true } })),
  OrdenCompra: async (id, empresaId) =>
    Boolean(await prisma.ordenCompra.findFirst({ where: { id, empresaId }, select: { id: true } })),
  Empleado: async (id, empresaId) =>
    Boolean(await prisma.empleado.findFirst({ where: { id, empresaId }, select: { id: true } })),
  Equipo: async (id, empresaId) =>
    Boolean(await prisma.equipo.findFirst({ where: { id, empresaId }, select: { id: true } })),
  ActivoFijo: async (id, empresaId) =>
    Boolean(await prisma.activoFijo.findFirst({ where: { id, empresaId }, select: { id: true } })),
};

/**
 * ¿La entidad existe Y es de esta compañía?
 *
 * Sin `empresaId` contesta que no. No es un descuido: quien llama desde un
 * Server Action siempre tiene la compañía activa a mano, y dejar pasar la
 * comprobación cuando falta convertiría un olvido en un agujero silencioso.
 *
 * El id llega del navegador, así que se mira antes de consultar: un id
 * absurdamente largo es una consulta que no vale la pena hacer.
 */
export async function entidadEsDeLaEmpresa(
  entidadTipo: string,
  entidadId: string,
  empresaId?: string
): Promise<boolean> {
  if (!esEntidadDeLaEmpresa(entidadTipo)) return false;
  if (!entidadId || entidadId.length > 64) return false;
  if (!empresaId) return false;
  return COMPROBACION[entidadTipo](entidadId, empresaId);
}
