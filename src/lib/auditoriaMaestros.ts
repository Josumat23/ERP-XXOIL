import { Prisma, type $Enums, type Usuario } from "@/generated/prisma/client";

/** Secretos: nunca se guardan, ni siquiera parcialmente. */
const CAMPOS_SENSIBLES = new Set([
  "passwordHash",
  "sunatClaveSol",
  "sunatCertificadoPassword",
  "token",
]);

/**
 * Datos que no son secretos pero tampoco deberían quedar completos acá.
 *
 * La bitácora es otro lugar, con otras reglas de acceso: quien puede leer la
 * auditoría no es necesariamente quien puede ver una cuenta bancaria. Pero
 * borrarlos del todo dejaría un registro inútil —«alguien cambió la cuenta»,
 * sin decir cuál—, así que se guardan enmascarados: se ve QUÉ cambió y no el
 * número entero.
 */
const CAMPOS_ENMASCARADOS = new Set(["numeroCuenta", "cci"]);

export function enmascarar(valor: string): string {
  // Menos de cinco caracteres no tiene final que mostrar sin mostrarlo todo.
  if (valor.length <= 4) return "••••";
  return "•".repeat(valor.length - 4) + valor.slice(-4);
}

export function serializarCambiosMaestro(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return JSON.stringify(valor, (clave, contenido: unknown) => {
    if (CAMPOS_SENSIBLES.has(clave)) return "[PROTEGIDO]";
    if (CAMPOS_ENMASCARADOS.has(clave) && typeof contenido === "string") {
      return enmascarar(contenido);
    }
    if (typeof contenido === "bigint") return contenido.toString();
    return contenido;
  });
}

type ActorAuditoria = Pick<Usuario, "id" | "nombre">;

type DatosAuditoria = {
  empresaId?: string;
  entidad: string;
  registroId: string;
  accion: $Enums.AccionAuditoriaMaestro;
  antes?: unknown;
  despues?: unknown;
  usuario: ActorAuditoria;
};

export async function registrarAuditoriaMaestro(
  tx: Prisma.TransactionClient,
  datos: DatosAuditoria
): Promise<void> {
  await tx.auditoriaMaestro.create({
    data: {
      empresaId: datos.empresaId ?? "1",
      entidad: datos.entidad,
      registroId: datos.registroId,
      accion: datos.accion,
      valoresAntes: serializarCambiosMaestro(datos.antes),
      valoresDespues: serializarCambiosMaestro(datos.despues),
      usuarioId: datos.usuario.id,
      usuarioNombre: datos.usuario.nombre,
    },
  });
}