import { Prisma, type $Enums, type Usuario } from "@/generated/prisma/client";

const CAMPOS_SENSIBLES = new Set([
  "passwordHash",
  "sunatClaveSol",
  "sunatCertificadoPassword",
  "token",
]);

export function serializarCambiosMaestro(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return JSON.stringify(valor, (clave, contenido: unknown) => {
    if (CAMPOS_SENSIBLES.has(clave)) return "[PROTEGIDO]";
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