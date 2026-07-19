"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const zonaId = String(formData.get("zonaId") ?? "") || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;

  if (!razonSocial) return { error: "La razón social es obligatoria." } as const;
  if (ruc && !/^\d{8}(\d{3})?$/.test(ruc)) {
    return { error: "El documento debe ser un DNI (8 dígitos) o RUC (11 dígitos)." } as const;
  }

  return { datos: { razonSocial, ruc, zonaId, direccion, telefono, email } } as const;
}

export async function crearCliente(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.cliente.create({ data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un cliente con el documento ${resultado.datos.ruc}.` };
    }
    throw e;
  }

  revalidatePath("/comercial/clientes");
  redirect("/comercial/clientes");
}

export async function actualizarCliente(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.cliente.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un cliente con el documento ${resultado.datos.ruc}.` };
    }
    throw e;
  }

  revalidatePath("/comercial/clientes");
  redirect("/comercial/clientes");
}

export async function alternarActivoCliente(id: string, activo: boolean) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  await prisma.cliente.update({ where: { id }, data: { activo } });
  revalidatePath("/comercial/clientes");
}
