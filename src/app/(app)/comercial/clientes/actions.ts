"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CanalCliente, CondicionPago, Prisma, TipoDocumentoFiscal } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoCliente } from "@/lib/correlativos";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const nombreComercial = String(formData.get("nombreComercial") ?? "").trim() || null;
  const tipoDocumentoFiscalRaw = String(formData.get("tipoDocumentoFiscal") ?? "RUC");
  const tipoDocumentoFiscal = Object.values(TipoDocumentoFiscal).find(
    (tipo) => tipo === tipoDocumentoFiscalRaw
  );
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "Peru").trim() || "Peru";
  const canalRaw = String(formData.get("canal") ?? "").trim();
  const canal = canalRaw
    ? Object.values(CanalCliente).find((valor) => valor === canalRaw)
    : null;
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
  const condicionPagoDefectoRaw = String(formData.get("condicionPagoDefecto") ?? "CONTADO");
  const condicionPagoDefecto = Object.values(CondicionPago).find(
    (condicion) => condicion === condicionPagoDefectoRaw
  );
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!razonSocial) return { error: "La razón social es obligatoria." } as const;
  if (!tipoDocumentoFiscal) {
    return { error: "Seleccione un tipo de documento fiscal válido." } as const;
  }
  if (canalRaw && !canal) {
    return { error: "Seleccione un canal de cliente válido." } as const;
  }
  // El formato DNI/RUC de 8 u 11 dígitos solo aplica a documentos peruanos —
  // un cliente extranjero (RUT, NIT, RFC, EIN, VAT, etc.) tiene su propio
  // formato, así que no se valida con una regla fija.
  if (tipoDocumentoFiscal === "RUC" && ruc && !/^\d{8}(\d{3})?$/.test(ruc)) {
    return { error: "El documento debe ser un DNI (8 dígitos) o RUC (11 dígitos)." } as const;
  }
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) {
    return { error: "El límite de crédito debe ser un número válido (0 = sin límite)." } as const;
  }
  if (!condicionPagoDefecto) {
    return { error: "Seleccione la condición de pago habitual." } as const;
  }

  return {
    datos: {
      razonSocial,
      nombreComercial,
      tipoDocumentoFiscal,
      ruc,
      pais,
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
    const empresaId = await obtenerEmpresaActivaId();
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoCliente(tx);
      const cliente = await tx.cliente.create({
        data: { ...resultado.datos, codigo, empresaId },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "Cliente",
        registroId: cliente.id,
        accion: "CREAR",
        despues: cliente,
        usuario: auth.usuario,
      });
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

  const empresaId = await obtenerEmpresaActivaId();
  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const antes = await tx.cliente.findUnique({ where: { id } });
      if (!perteneceAEmpresaActiva(antes, empresaId)) return false;
      const despues = await tx.cliente.update({ where: { id }, data: resultado.datos });
      await registrarAuditoriaMaestro(tx, {
        empresaId: despues.empresaId,
        entidad: "Cliente",
        registroId: id,
        accion: "ACTUALIZAR",
        antes,
        despues,
        usuario: auth.usuario,
      });
      return true;
    });
    if (!actualizado) return { error: "El cliente no pertenece a la compañía activa." };
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
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.cliente.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.cliente.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, {
      empresaId: despues.empresaId,
      entidad: "Cliente",
      registroId: id,
      accion: activo ? "ACTIVAR" : "DESACTIVAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });
  revalidatePath("/comercial/clientes");
}
