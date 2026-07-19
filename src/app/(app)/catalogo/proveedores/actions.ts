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
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;

  if (!razonSocial) return { error: "La razón social es obligatoria." } as const;
  if (ruc && !/^\d{11}$/.test(ruc)) return { error: "El RUC debe tener 11 dígitos." } as const;

  return { datos: { razonSocial, ruc, telefono, email, direccion } } as const;
}

export async function crearProveedor(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.proveedor.create({ data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un proveedor con el RUC ${resultado.datos.ruc}.` };
    }
    throw e;
  }

  revalidatePath("/catalogo/proveedores");
  redirect("/catalogo/proveedores");
}

export async function actualizarProveedor(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.proveedor.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un proveedor con el RUC ${resultado.datos.ruc}.` };
    }
    throw e;
  }

  revalidatePath("/catalogo/proveedores");
  redirect("/catalogo/proveedores");
}

export async function alternarActivoProveedor(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  await prisma.proveedor.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/proveedores");
}
