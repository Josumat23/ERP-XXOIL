export const TAMANIO_MAXIMO_CERTIFICADO_SUNAT = 2 * 1024 * 1024;

export function validarArchivoCertificadoSunat(archivo: { name: string; size: number }): string | null {
  if (archivo.size > TAMANIO_MAXIMO_CERTIFICADO_SUNAT) {
    return "El certificado digital supera el tamaño máximo permitido (2 MB).";
  }
  if (!/\.(pfx|p12)$/i.test(archivo.name)) {
    return "El certificado digital debe ser un archivo .pfx o .p12.";
  }
  return null;
}