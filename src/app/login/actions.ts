"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verificarPassword, crearSesion } from "@/lib/auth";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(
  _prevState: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const usuario = String(formData.get("usuario") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!usuario || !password) {
    return { error: "Ingrese su usuario y contraseña." };
  }

  const registro = await prisma.usuario.findUnique({
    where: { empresaId_usuario: { empresaId: "1", usuario } },
  });

  if (!registro || !registro.activo || !verificarPassword(password, registro.passwordHash)) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await crearSesion(registro.id);
  redirect("/");
}
