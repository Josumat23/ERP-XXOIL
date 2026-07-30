"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

export async function agregarContacto(
  entidadTipo: string,
  entidadId: string,
  rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const esPrincipal = formData.get("esPrincipal") === "on";

  if (!nombre) return { error: "El nombre es obligatorio." };

  await prisma.$transaction(async (tx) => {
    if (esPrincipal) {
      await tx.contacto.updateMany({
        where: { entidadTipo, entidadId },
        data: { esPrincipal: false },
      });
    }
    await tx.contacto.create({
      data: { entidadTipo, entidadId, nombre, cargo, telefono, email, esPrincipal },
    });
  });

  revalidatePath(rutaRevalidar);
  return {};
}

export async function eliminarContacto(id: string, rutaRevalidar: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  await prisma.contacto.delete({ where: { id } });
  revalidatePath(rutaRevalidar);
}
