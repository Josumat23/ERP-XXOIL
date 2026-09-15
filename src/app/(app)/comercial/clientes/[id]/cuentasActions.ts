"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { MENSAJE_ERROR_CUENTA, validarCuenta } from "@/lib/cuentasBancariasCliente";

export type EstadoFormulario = { error?: string };

/**
 * Las cuentas bancarias son de **Finanzas**, no de Ventas.
 *
 * El resto de la ficha del cliente la edita quien tiene permiso de Ventas. Acá
 * no: un número de cuenta cambiado por quien no debía tocarlo es una
 * transferencia que se va a otro lado. La restricción es el punto del bloque,
 * no un adorno.
 */
async function autorizar() {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return {
      error:
        "Las cuentas bancarias del cliente las administra Finanzas. Su grupo de seguridad no tiene ese permiso.",
    } as const;
  }
  return auth;
}

function leer(formData: FormData) {
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;
  return {
    banco: String(formData.get("banco") ?? "").trim(),
    tipoCuenta: String(formData.get("tipoCuenta") ?? "CORRIENTE"),
    numeroCuenta: String(formData.get("numeroCuenta") ?? "").trim(),
    cci: texto("cci"),
    moneda: String(formData.get("moneda") ?? "PEN"),
    titular: texto("titular"),
    notas: texto("notas"),
    principal: formData.get("principal") === "on",
    activa: formData.get("activa") !== "off",
  };
}

/** Una sola principal: el índice impide dos, pero reemplazar es lo que se pide. */
async function liberarPrincipal(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clienteId: string,
  exceptoId?: string
) {
  await tx.cuentaBancariaCliente.updateMany({
    where: { clienteId, esPrincipal: true, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
    data: { esPrincipal: null },
  });
}

export async function crearCuentaBancaria(
  clienteId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = validarCuenta(datos);
  if (error) return { error: MENSAJE_ERROR_CUENTA[error] };

  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del navegador: se relee acotado a la compañía activa.
      const cliente = await tx.cliente.findFirst({ where: { id: clienteId, empresaId } });
      if (!cliente) throw new Error("El cliente no pertenece a la compañía activa.");

      if (datos.principal) await liberarPrincipal(tx, clienteId);

      const { principal, ...campos } = datos;
      const creada = await tx.cuentaBancariaCliente.create({
        data: {
          ...campos,
          tipoCuenta: campos.tipoCuenta as "CORRIENTE" | "AHORROS",
          empresaId,
          clienteId,
          esPrincipal: principal ? true : null,
        },
      });
      // El número va enmascarado a la bitácora: se ve qué cuenta cambió sin
      // dejar el número completo en otro lugar con otras reglas de acceso.
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "CuentaBancariaCliente",
        registroId: creada.id,
        accion: "CREAR",
        despues: creada,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la cuenta." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

export async function actualizarCuentaBancaria(
  cuentaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = validarCuenta(datos);
  if (error) return { error: MENSAJE_ERROR_CUENTA[error] };

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await prisma.cuentaBancariaCliente.findFirst({
    where: { id: cuentaId, empresaId, cliente: { empresaId } },
  });
  if (!existente) return { error: "La cuenta no pertenece a la compañía activa." };

  const clienteId = existente.clienteId;

  try {
    await prisma.$transaction(async (tx) => {
      if (datos.principal) await liberarPrincipal(tx, clienteId, cuentaId);

      const { principal, ...campos } = datos;
      const despues = await tx.cuentaBancariaCliente.update({
        where: { id: cuentaId },
        data: {
          ...campos,
          tipoCuenta: campos.tipoCuenta as "CORRIENTE" | "AHORROS",
          esPrincipal: principal ? true : null,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "CuentaBancariaCliente",
        registroId: cuentaId,
        accion: "ACTUALIZAR",
        antes: existente,
        despues,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la cuenta." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

/**
 * Desactivar, no borrar.
 *
 * Un cobro o una devolución ya hechos apuntan a la cuenta que se usó. Borrarla
 * dejaría esos movimientos sin explicación de a dónde fue la plata.
 */
export async function desactivarCuentaBancaria(cuentaId: string): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await prisma.cuentaBancariaCliente.findFirst({
    where: { id: cuentaId, empresaId, cliente: { empresaId } },
  });
  if (!existente) return { error: "La cuenta no pertenece a la compañía activa." };

  await prisma.$transaction(async (tx) => {
    const despues = await tx.cuentaBancariaCliente.update({
      where: { id: cuentaId },
      data: { activa: false, esPrincipal: null },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "CuentaBancariaCliente",
      registroId: cuentaId,
      accion: "DESACTIVAR",
      antes: existente,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath(`/comercial/clientes/${existente.clienteId}`);
  return {};
}
