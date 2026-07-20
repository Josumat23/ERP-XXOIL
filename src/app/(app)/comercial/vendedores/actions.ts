"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

function leerDatos(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoVendedor;
  const tasaComision = Number(formData.get("tasaComision"));
  const zonaId = String(formData.get("zonaId") ?? "") || null;

  if (!nombre) return { error: "El nombre es obligatorio." } as const;
  if (tipo !== "CON_BASICO" && tipo !== "SOLO_COMISION") {
    return { error: "Seleccione el tipo de vendedor." } as const;
  }
  if (!Number.isFinite(tasaComision) || tasaComision < 0 || tasaComision > 100) {
    return { error: "La tasa de comisión debe estar entre 0 y 100." } as const;
  }

  return { datos: { nombre, documento, telefono, email, tipo, tasaComision, zonaId } } as const;
}

export async function crearVendedor(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  await prisma.vendedor.create({ data: resultado.datos });

  revalidatePath("/comercial/vendedores");
  redirect("/comercial/vendedores");
}

export async function actualizarVendedor(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  // La tasa nueva aplica solo a comisiones futuras: las generadas guardan su propia tasa.
  await prisma.vendedor.update({ where: { id }, data: resultado.datos });

  revalidatePath("/comercial/vendedores");
  redirect("/comercial/vendedores");
}

export async function alternarActivoVendedor(id: string, activo: boolean) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;
  await prisma.vendedor.update({ where: { id }, data: { activo } });
  revalidatePath("/comercial/vendedores");
}
