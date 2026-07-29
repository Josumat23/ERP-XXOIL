"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { DIRECTORIO_ADJUNTOS, TIPOS_MIME_PERMITIDOS, TAMANIO_MAXIMO_BYTES } from "@/lib/adjuntos";

export type EstadoFormulario = { error?: string };

export async function subirAdjunto(
  entidadTipo: string,
  entidadId: string,
  rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccione un archivo." };
  }
  if (archivo.size > TAMANIO_MAXIMO_BYTES) {
    return { error: "El archivo supera el tamaño máximo permitido (10 MB)." };
  }
  if (!TIPOS_MIME_PERMITIDOS.includes(archivo.type)) {
    return { error: "Tipo de archivo no permitido (use PDF, imagen o documento de Office)." };
  }

  await mkdir(DIRECTORIO_ADJUNTOS, { recursive: true });
  const nombreArchivo = `${randomUUID()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());
  await writeFile(path.join(DIRECTORIO_ADJUNTOS, nombreArchivo), buffer);

  await prisma.adjunto.create({
    data: {
      entidadTipo,
      entidadId,
      nombreArchivo,
      nombreOriginal: archivo.name,
      mimeType: archivo.type,
      tamanioBytes: archivo.size,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
    },
  });

  revalidatePath(rutaRevalidar);
  return {};
}

export async function eliminarAdjunto(id: string, rutaRevalidar: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;

  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return;
  if (usuario.rol !== "ADMIN" && adjunto.usuarioId !== usuario.id) return;

  await prisma.adjunto.delete({ where: { id } });
  try {
    await unlink(path.join(DIRECTORIO_ADJUNTOS, adjunto.nombreArchivo));
  } catch {
    // El archivo físico ya no existe en disco: no bloquea el borrado del registro.
  }

  revalidatePath(rutaRevalidar);
}
