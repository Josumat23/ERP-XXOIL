"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const tipoDocumentoFiscal = String(
    formData.get("tipoDocumentoFiscal") ?? "RUC"
  ) as $Enums.TipoDocumentoFiscal;
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "Peru").trim() || "Peru";
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const contactoNombre = String(formData.get("contactoNombre") ?? "").trim() || null;
  const contactoTelefono = String(formData.get("contactoTelefono") ?? "").trim() || null;
  const cuentaBancaria = String(formData.get("cuentaBancaria") ?? "").trim() || null;
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const numeroCuenta = String(formData.get("numeroCuenta") ?? "").trim() || null;
  const cci = String(formData.get("cci") ?? "").trim() || null;
  const swift = String(formData.get("swift") ?? "").trim() || null;
  const iban = String(formData.get("iban") ?? "").trim() || null;
  const condicionPagoDias = Number(formData.get("condicionPagoDias") ?? 0);
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!razonSocial) return { error: "La razón social es obligatoria." } as const;
  // El formato de 11 dígitos solo aplica al RUC peruano — un RUT, NIT, RFC,
  // EIN, VAT u otro documento extranjero tiene su propio formato, así que no
  // se valida con una regla fija.
  if (tipoDocumentoFiscal === "RUC" && ruc && !/^\d{11}$/.test(ruc)) {
    return { error: "El RUC debe tener 11 dígitos." } as const;
  }
  if (!Number.isInteger(condicionPagoDias) || condicionPagoDias < 0) {
    return { error: "La condición de pago debe ser 0 (contado) o días de crédito." } as const;
  }

  return {
    datos: {
      razonSocial,
      tipoDocumentoFiscal,
      ruc,
      pais,
      telefono,
      email,
      direccion,
      contactoNombre,
      contactoTelefono,
      cuentaBancaria,
      banco,
      numeroCuenta,
      cci,
      swift,
      iban,
      condicionPagoDias,
      notas,
    },
  } as const;
}

export async function crearProveedor(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    const empresaId = await obtenerEmpresaActivaId();
    await prisma.$transaction(async (tx) => {
      const registro = await tx.proveedor.create({ data: { ...resultado.datos, empresaId } });
      await registrarAuditoriaMaestro(tx, { empresaId, entidad: "Proveedor", registroId: registro.id, accion: "CREAR", despues: registro, usuario: auth.usuario });
    });
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
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.proveedor.findUniqueOrThrow({ where: { id } });
      const despues = await tx.proveedor.update({ where: { id }, data: resultado.datos });
      await registrarAuditoriaMaestro(tx, { empresaId: despues.empresaId, entidad: "Proveedor", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
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
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.proveedor.findUniqueOrThrow({ where: { id } });
    const despues = await tx.proveedor.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId: despues.empresaId, entidad: "Proveedor", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/catalogo/proveedores");
}
