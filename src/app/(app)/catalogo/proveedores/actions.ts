"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoDocumentoFiscal } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import { resolverUbigeoEnTransaccion } from "@/lib/ubigeos";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import {
  condicionAbierta,
  MENSAJE_RECHAZO_VIGENCIA,
  validarNuevaCondicion,
} from "@/lib/condicionesProveedor";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const tipoDocumentoFiscalRaw = String(formData.get("tipoDocumentoFiscal") ?? "RUC");
  const tipoDocumentoFiscal = Object.values(TipoDocumentoFiscal).find(
    (tipo) => tipo === tipoDocumentoFiscalRaw
  );
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "Peru").trim() || "Peru";
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const ubigeoId = String(formData.get("ubigeoId") ?? "").trim() || null;
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
  if (!tipoDocumentoFiscal) {
    return { error: "Seleccione un tipo de documento fiscal válido." } as const;
  }
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
      ubigeoId,
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
      // El id del distrito viene del navegador: se valida contra el catálogo.
      const ubigeo = await resolverUbigeoEnTransaccion(tx, resultado.datos.ubigeoId);
      const registro = await tx.proveedor.create({
        data: { ...resultado.datos, ubigeoId: ubigeo?.id ?? null, empresaId },
      });
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

  const empresaId = await obtenerEmpresaActivaId();
  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const antes = await tx.proveedor.findUnique({ where: { id } });
      if (!perteneceAEmpresaActiva(antes, empresaId)) return false;
      const ubigeo = await resolverUbigeoEnTransaccion(tx, resultado.datos.ubigeoId);
      const despues = await tx.proveedor.update({
        where: { id },
        data: { ...resultado.datos, ubigeoId: ubigeo?.id ?? null },
      });
      await registrarAuditoriaMaestro(tx, { empresaId: despues.empresaId, entidad: "Proveedor", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
      return true;
    });
    if (!actualizado) return { error: "El proveedor no pertenece a la compañía activa." };
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
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.proveedor.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.proveedor.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId: despues.empresaId, entidad: "Proveedor", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/catalogo/proveedores");
}

/**
 * Registra una condición comercial nueva y cierra la vigente en la misma
 * fecha, en una sola transacción.
 *
 * Actualiza además `Proveedor.condicionPagoDias`, que sigue siendo el valor
 * vigente que lee el resto del sistema: el historial responde "qué regía
 * cuándo y por qué", no reemplaza al maestro.
 */
export async function registrarCondicionComercial(
  proveedorId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const condicionPagoDias = Number(formData.get("condicionPagoDias") ?? 0);
  const motivo = String(formData.get("motivo") ?? "").trim();
  const desdeStr = String(formData.get("vigenteDesde") ?? "");
  const vigenteDesde = crearFechaCalendarioLocal(desdeStr);
  if (!vigenteDesde) return { error: "Indique desde cuándo rige la nueva condición." };
  if (motivo.length > 500) return { error: "El motivo no puede superar los 500 caracteres." };

  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del navegador: el proveedor tiene que ser de la compañía
      // activa.
      const proveedor = await tx.proveedor.findFirst({
        where: { id: proveedorId, empresaId },
        select: { id: true },
      });
      if (!proveedor) throw new Error("El proveedor no pertenece a la compañía activa.");

      const condiciones = await tx.condicionComercialProveedor.findMany({
        where: { proveedorId },
        select: { id: true, condicionPagoDias: true, vigenteDesde: true, vigenteHasta: true },
      });

      const rechazo = validarNuevaCondicion(condiciones, {
        condicionPagoDias,
        vigenteDesde,
        motivo,
      });
      if (rechazo) throw new Error(MENSAJE_RECHAZO_VIGENCIA[rechazo]);

      // Cierra la vigente en la MISMA fecha en que empieza la nueva: los
      // rangos son semiabiertos, así que no quedan huecos ni solapamientos.
      const abierta = condicionAbierta(condiciones);
      if (abierta) {
        await tx.condicionComercialProveedor.update({
          where: { id: abierta.id },
          data: { vigenteHasta: vigenteDesde },
        });
      }

      await tx.condicionComercialProveedor.create({
        data: {
          proveedorId,
          condicionPagoDias,
          vigenteDesde,
          motivo,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      const antes = await tx.proveedor.findUnique({ where: { id: proveedorId } });
      const despues = await tx.proveedor.update({
        where: { id: proveedorId },
        data: { condicionPagoDias },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "Proveedor",
        registroId: proveedorId,
        accion: "ACTUALIZAR",
        antes,
        despues,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la condición." };
  }

  revalidatePath(`/catalogo/proveedores/${proveedorId}`);
  return {};
}
