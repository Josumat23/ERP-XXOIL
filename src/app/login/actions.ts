"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  crearSesion,
  estaBloqueadoLogin,
  registrarIntentoFallidoLogin,
  reiniciarIntentosLogin,
  verificarPasswordUniforme,
} from "@/lib/auth";

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
  const ahora = new Date();
  const bloqueado = registro ? estaBloqueadoLogin(registro.bloqueadoHasta, ahora) : false;
  if (!registro || !registro.activo || !passwordValido || bloqueado) {
    if (registro && !bloqueado) {
      await registrarIntentoFallidoLogin(registro.id, ahora);
    }
    return { error: "Usuario o contraseña incorrectos." };
  }

  await reiniciarIntentosLogin(registro.id);
  await crearSesion(registro.id);
  redirect("/");
}
