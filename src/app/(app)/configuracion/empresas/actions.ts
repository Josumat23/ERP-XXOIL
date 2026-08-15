"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { establecerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

export async function crearEmpresa(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "").trim();
  const monedaFuncional = String(formData.get("monedaFuncional") ?? "PEN").trim() || "PEN";

  if (!razonSocial) return { error: "La razón social es obligatoria." };
  if (!pais) return { error: "El país es obligatorio." };

  try {
    await prisma.empresa.create({ data: { razonSocial, ruc, pais, monedaFuncional } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe una compañía con ese RUC." };
    }
    throw e;
  }

  revalidatePath("/configuracion/empresas");
  return {};
}

export async function alternarActivaEmpresa(id: string, activa: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;

  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa || empresa.esPrincipal) return; // la principal nunca se desactiva

  await prisma.empresa.update({ where: { id }, data: { activa } });
  revalidatePath("/configuracion/empresas");
}

export async function cambiarEmpresaActiva(id: string) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;

  const empresa = await prisma.empresa.findFirst({
    where: { id, activa: true },
    select: { id: true },
  });
  if (!empresa) return;

  await establecerEmpresaActivaId(empresa.id);
  revalidatePath("/", "layout");
}
