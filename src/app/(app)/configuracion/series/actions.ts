"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoDocumentoSerie[] = ["FACTURA", "NOTA_CREDITO", "GUIA_REMISION"];

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
    await prisma.serieDocumento.create({
      data: { tipoDocumento, serie, correlativoActual },
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
  await prisma.serieDocumento.update({ where: { id }, data: { activo } });
  revalidatePath("/configuracion/series");
}
