"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import type { $Enums } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

export async function agregarDireccion(
  entidadTipo: string,
  entidadId: string,
  rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };

  const tipo = String(formData.get("tipo") ?? "OTRA") as $Enums.TipoDireccion;
  const pais = String(formData.get("pais") ?? "").trim();
  const departamento = String(formData.get("departamento") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim() || null;
  const esPrincipal = formData.get("esPrincipal") === "on";

  if (!pais) return { error: "El país es obligatorio." };
  if (!direccion) return { error: "La dirección es obligatoria." };

  await prisma.$transaction(async (tx) => {
    if (esPrincipal) {
      await tx.direccion.updateMany({
        where: { entidadTipo, entidadId },
        data: { esPrincipal: false },
      });
    }
    await tx.direccion.create({
      data: {
        entidadTipo,
        entidadId,
        tipo,
        pais,
        departamento,
        provincia,
        distrito,
        direccion,
        codigoPostal,
        esPrincipal,
      },
    });
  });

  revalidatePath(rutaRevalidar);
  return {};
}

export async function eliminarDireccion(id: string, rutaRevalidar: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  await prisma.direccion.delete({ where: { id } });
  revalidatePath(rutaRevalidar);
}
