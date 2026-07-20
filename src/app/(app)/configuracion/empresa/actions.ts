"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function guardarConfiguracionEmpresa(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const nombreComercial = String(formData.get("nombreComercial") ?? "").trim() || null;
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const ciudad = String(formData.get("ciudad") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const sitioWeb = String(formData.get("sitioWeb") ?? "").trim() || null;
  const tasaIgv = Number(formData.get("tasaIgv"));

  if (!razonSocial) return { error: "La razón social es obligatoria." };
  if (ruc && !/^\d{11}$/.test(ruc)) return { error: "El RUC debe tener 11 dígitos." };
  if (!Number.isFinite(tasaIgv) || tasaIgv < 0 || tasaIgv > 30) {
    return { error: "La tasa de IGV debe estar entre 0 y 30%." };
  }

  const datos = {
    razonSocial,
    nombreComercial,
    ruc,
    direccion,
    ciudad,
    telefono,
    email,
    sitioWeb,
    tasaIgv,
  };

  await prisma.configuracionEmpresa.upsert({
    where: { id: "1" },
    update: datos,
    create: { id: "1", ...datos },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
