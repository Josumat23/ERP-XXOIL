"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verificarPasswordUniforme, crearSesion } from "@/lib/auth";

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
  if (usuario.length > 100 || password.length > 256) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  const registro = await prisma.usuario.findUnique({
    where: { empresaId_usuario: { empresaId: "1", usuario } },
  });

  const passwordValido = verificarPasswordUniforme(password, registro?.passwordHash);
  if (!registro || !registro.activo || !passwordValido) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await crearSesion(registro.id);
  redirect("/");
}
