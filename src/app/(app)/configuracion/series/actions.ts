"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva, requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoDocumentoSerie[] = [
  "FACTURA",
  "BOLETA",
  "NOTA_CREDITO",
  "NOTA_DEBITO",
  "GUIA_REMISION",
];

export async function crearSerieDocumento(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const tipoDocumento = String(formData.get("tipoDocumento") ?? "") as $Enums.TipoDocumentoSerie;
  const serie = String(formData.get("serie") ?? "").trim().toUpperCase();
  const correlativoActual = Number(formData.get("correlativoActual") ?? 0);

  if (!TIPOS_VALIDOS.includes(tipoDocumento)) return { error: "Seleccione el tipo de documento." };
  if (!/^[A-Z0-9]{4}$/.test(serie)) {
    return { error: "La serie debe tener 4 caracteres (ej. F001, T001, FC01)." };
  }
  if (!Number.isInteger(correlativoActual) || correlativoActual < 0) {
    return { error: "El correlativo inicial debe ser un entero mayor o igual a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creada = await tx.serieDocumento.create({
        data: { empresaId: auth.usuario.empresaId, tipoDocumento, serie, correlativoActual },
      });
      await registrarAuditoriaMaestro(tx, { empresaId: creada.empresaId, entidad: "SerieDocumento", registroId: creada.id, accion: "CREAR", despues: creada, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la serie "${serie}" para ese tipo de documento.` };
    }
    throw e;
  }

  revalidatePath("/configuracion/series");
  return {};
}

export async function alternarActivoSerie(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  // El id llega del navegador: se relee la serie para confirmar que es de la
  // compañía activa antes de tocarla.
  const empresaId = await obtenerEmpresaActivaId();
  const serie = await prisma.serieDocumento.findUnique({ where: { id } });
  if (!perteneceAEmpresaActiva(serie, empresaId)) return;
  await prisma.$transaction(async (tx) => {
    const despues = await tx.serieDocumento.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "SerieDocumento", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes: serie, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/series");
}
