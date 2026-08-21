import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { existeEntidadAdjunto, puedeLeerAdjunto, resolverRutaAdjunto } from "@/lib/adjuntos";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await obtenerUsuario();
  if (!usuario) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  if (!puedeLeerAdjunto(usuario, adjunto.entidadTipo)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (!(await existeEntidadAdjunto(adjunto.entidadTipo, adjunto.entidadId, empresaId))) {
    return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  }

  const rutaArchivo = resolverRutaAdjunto(adjunto.nombreArchivo);
  if (!rutaArchivo) {
    return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  }

  try {
    const buffer = await readFile(rutaArchivo);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": adjunto.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(adjunto.nombreOriginal)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo ya no existe en disco." }, { status: 404 });
  }
}
