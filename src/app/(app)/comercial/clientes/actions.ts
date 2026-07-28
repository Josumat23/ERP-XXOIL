"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoCliente } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const nombreComercial = String(formData.get("nombreComercial") ?? "").trim() || null;
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const canalRaw = String(formData.get("canal") ?? "").trim();
  const canal = canalRaw ? (canalRaw as $Enums.CanalCliente) : null;
  const departamento = String(formData.get("departamento") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const contactoNombre = String(formData.get("contactoNombre") ?? "").trim() || null;
  const contactoTelefono = String(formData.get("contactoTelefono") ?? "").trim() || null;
  const zonaId = String(formData.get("zonaId") ?? "") || null;
  const vendedorId = String(formData.get("vendedorId") ?? "") || null;
  const limiteCredito = Number(formData.get("limiteCredito") ?? 0);
  const condicionPagoDefecto = String(
    formData.get("condicionPagoDefecto") ?? "CONTADO"
  ) as $Enums.CondicionPago;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!razonSocial) return { error: "La razón social es obligatoria." } as const;
  if (ruc && !/^\d{8}(\d{3})?$/.test(ruc)) {
    return { error: "El documento debe ser un DNI (8 dígitos) o RUC (11 dígitos)." } as const;
  }
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) {
    return { error: "El límite de crédito debe ser un número válido (0 = sin límite)." } as const;
  }
  if (!["CONTADO", "DIAS_15", "DIAS_30"].includes(condicionPagoDefecto)) {
    return { error: "Seleccione la condición de pago habitual." } as const;
  }

  return {
    datos: {
      razonSocial,
      nombreComercial,
      ruc,
      canal,
      departamento,
      provincia,
      distrito,
      direccion,
      telefono,
      email,
      contactoNombre,
      contactoTelefono,
      zonaId,
      vendedorId,
      limiteCredito,
      condicionPagoDefecto,
      notas,
    },
  } as const;
}

export async function crearCliente(
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

  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoCliente(tx);
      await tx.cliente.create({ data: { ...resultado.datos, codigo } });
    });
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
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

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
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;
  await prisma.cliente.update({ where: { id }, data: { activo } });
  revalidatePath("/comercial/clientes");
}
