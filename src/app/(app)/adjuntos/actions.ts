"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  DIRECTORIO_ADJUNTOS,
  TIPOS_MIME_PERMITIDOS,
  TAMANIO_MAXIMO_BYTES,
  puedeEditarAdjunto,
  existeEntidadAdjunto,
  resolverRutaAdjunto,
  esTipoEntidadAdjunto,
  rutaEntidadAdjunto,
} from "@/lib/adjuntos";

export type EstadoFormulario = { error?: string };

export async function subirAdjunto(
  entidadTipo: string,
  entidadId: string,
  _rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  void _rutaRevalidar;
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };
  if (!esTipoEntidadAdjunto(entidadTipo) || !(await puedeEditarAdjunto(usuario, entidadTipo))) {
    return { error: "No tiene permiso para adjuntar archivos en este módulo." };
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (!(await existeEntidadAdjunto(entidadTipo, entidadId, empresaId))) {
    return { error: "La entidad donde intenta adjuntar el archivo no existe en la compañía activa." };
  }

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
  if (archivo.name.length > 255) {
    return { error: "El nombre del archivo no puede superar 255 caracteres." };
  }

  await mkdir(DIRECTORIO_ADJUNTOS, { recursive: true });
  const nombreArchivo = `${randomUUID()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaArchivo = resolverRutaAdjunto(nombreArchivo);
  if (!rutaArchivo) return { error: "No se pudo construir una ruta segura para el adjunto." };
  await writeFile(rutaArchivo, buffer);

  try {
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
  } catch {
    try {
      await unlink(rutaArchivo);
    } catch {
      throw new Error("Falló el registro del adjunto y no se pudo limpiar el archivo físico.");
    }
    return { error: "No se pudo registrar el adjunto. El archivo cargado fue descartado." };
  }

  revalidatePath(rutaEntidadAdjunto(entidadTipo, entidadId));
  return {};
}

export async function eliminarAdjunto(id: string, _rutaRevalidar: string) {
  void _rutaRevalidar;
  const usuario = await obtenerUsuario();
  if (!usuario) return;

  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return;
  if (!esTipoEntidadAdjunto(adjunto.entidadTipo)) return;
  if (!(await puedeEditarAdjunto(usuario, adjunto.entidadTipo))) return;
  if (usuario.rol !== "ADMIN" && adjunto.usuarioId !== usuario.id) return;
  const empresaId = await obtenerEmpresaActivaId();
  if (!(await existeEntidadAdjunto(adjunto.entidadTipo, adjunto.entidadId, empresaId))) return;

  await prisma.adjunto.delete({ where: { id } });
  const rutaArchivo = resolverRutaAdjunto(adjunto.nombreArchivo);
  try {
    if (rutaArchivo) await unlink(rutaArchivo);
  } catch {
    // El archivo físico ya no existe en disco: no bloquea el borrado del registro.
  }

  revalidatePath(rutaEntidadAdjunto(adjunto.entidadTipo, adjunto.entidadId));
}
