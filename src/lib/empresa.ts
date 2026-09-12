import { prisma } from "@/lib/prisma";
import type { ConfiguracionEmpresa, Prisma } from "@/generated/prisma/client";

type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * Configuración de una compañía. Hay una fila por compañía, no una sola para
 * todo el sistema: esta fila gobierna el RUC del emisor, la moneda, la tasa de
 * IGV, las credenciales SUNAT y los umbrales de aprobación, y esos datos son
 * propios de cada sociedad legal.
 *
 * `empresaId` es obligatorio a propósito. Un valor por defecto haría que un
 * llamador que se olvidara de pasarlo leyera la configuración de la compañía
 * principal sin ningún error visible — exactamente el tipo de fuga silenciosa
 * que este cambio viene a cerrar.
 *
 * Si la compañía todavía no tiene configuración, se crea con los valores por
 * defecto del esquema. **No se copia nada de otra compañía**: razón social,
 * RUC, certificado y credenciales SUNAT son de la sociedad que los contrató, y
 * heredarlos haría que una compañía nueva emitiera con la identidad de otra.
 */
export type ConfiguracionConUbigeo = ConfiguracionEmpresa & {
  /** Distrito del catálogo SUNAT, con su código de 6 dígitos para el XML. */
  ubigeo: { id: string; codigo: string; departamento: string; provincia: string; distrito: string } | null;
};

export async function obtenerConfiguracionEmpresa(
  empresaId: string,
  cliente: Cliente = prisma
): Promise<ConfiguracionConUbigeo> {
  // El ubigeo viene incluido siempre: es la dirección fiscal del emisor, y
  // quien arma un comprobante electrónico necesita su código junto al resto de
  // la configuración, no en una segunda consulta fácil de olvidar.
  const existente = await cliente.configuracionEmpresa.findUnique({
    where: { empresaId },
    include: { ubigeo: true },
  });
  if (existente) return existente;
  // upsert y no create: dos peticiones simultáneas de la misma compañía
  // llegarían aquí a la vez, y el índice único de empresaId convertiría al
  // segundo create en un error en vez de devolverle la fila que ya existe.
  return cliente.configuracionEmpresa.upsert({
    where: { empresaId },
    create: { empresaId },
    update: {},
    include: { ubigeo: true },
  });
}
