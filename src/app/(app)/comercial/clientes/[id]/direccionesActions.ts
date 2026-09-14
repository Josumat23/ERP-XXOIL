"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import {
  MENSAJE_ERROR_DIRECCION,
  valorPrincipalDe,
  validarDireccion,
  type TipoDireccion,
} from "@/lib/direccionesCliente";

export type EstadoFormulario = { error?: string };

async function autorizar() {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." } as const;
  }
  return auth;
}

function numeroOpcional(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : NaN;
}

function leer(formData: FormData) {
  return {
    tipo: String(formData.get("tipo") ?? ""),
    principal: formData.get("principal") === "on",
    activa: formData.get("activa") !== "off",
    latitud: numeroOpcional(formData.get("latitud")),
    longitud: numeroOpcional(formData.get("longitud")),
    etiqueta: String(formData.get("etiqueta") ?? "").trim() || null,
    direccion: String(formData.get("direccion") ?? "").trim(),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
    ubigeoId: String(formData.get("ubigeoId") ?? "").trim() || null,
    codigoPostal: String(formData.get("codigoPostal") ?? "").trim() || null,
    pais: String(formData.get("pais") ?? "").trim() || "Peru",
    contactoNombre: String(formData.get("contactoNombre") ?? "").trim() || null,
    contactoTelefono: String(formData.get("contactoTelefono") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  };
}

/**
 * Deja una sola principal por tipo.
 *
 * El índice único de la base ya impide dos, pero rechazaría la escritura en
 * vez de reemplazar. Marcar una nueva como principal tiene que DESMARCAR la
 * anterior, que es lo que quien edita está pidiendo; ocurre dentro de la misma
 * transacción, así que no hay un instante con dos ni con ninguna.
 */
async function liberarPrincipal(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clienteId: string,
  tipo: TipoDireccion,
  exceptoId?: string
) {
  await tx.direccionCliente.updateMany({
    where: {
      clienteId,
      principalDe: tipo,
      ...(exceptoId ? { id: { not: exceptoId } } : {}),
    },
    data: { principalDe: null },
  });
}

/** La dirección se relee acotada a la compañía activa, por su cliente. */
async function direccionDeLaEmpresa(id: string, empresaId: string) {
  return prisma.direccionCliente.findFirst({
    where: { id, empresaId, cliente: { empresaId } },
  });
}

type DatosDireccion = ReturnType<typeof leer>;

function revisar(datos: DatosDireccion) {
  return validarDireccion({
    tipo: datos.tipo,
    direccion: datos.direccion,
    ubigeoId: datos.ubigeoId,
    latitud: datos.latitud,
    longitud: datos.longitud,
    principal: datos.principal,
    activa: datos.activa,
  });
}

export async function crearDireccion(
  clienteId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = revisar(datos);
  if (error) return { error: MENSAJE_ERROR_DIRECCION[error] };

  const empresaId = await obtenerEmpresaActivaId();
  const tipo = datos.tipo as TipoDireccion;

  try {
    await prisma.$transaction(async (tx) => {
      // El id del cliente llega del navegador: se relee acotado a la compañía.
      const cliente = await tx.cliente.findFirst({ where: { id: clienteId, empresaId } });
      if (!cliente) throw new Error("El cliente no pertenece a la compañía activa.");

      if (datos.principal) await liberarPrincipal(tx, clienteId, tipo);

      const { principal, ...campos } = datos;
      const creada = await tx.direccionCliente.create({
        data: {
          ...campos,
          tipo,
          empresaId,
          clienteId,
          principalDe: valorPrincipalDe(tipo, principal),
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "DireccionCliente",
        registroId: creada.id,
        accion: "CREAR",
        despues: creada,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la dirección." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

export async function actualizarDireccion(
  direccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = revisar(datos);
  if (error) return { error: MENSAJE_ERROR_DIRECCION[error] };

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await direccionDeLaEmpresa(direccionId, empresaId);
  if (!existente) return { error: "La dirección no pertenece a la compañía activa." };

  const tipo = datos.tipo as TipoDireccion;
  const clienteId = existente.clienteId;

  try {
    await prisma.$transaction(async (tx) => {
      if (datos.principal) await liberarPrincipal(tx, clienteId, tipo, direccionId);

      const { principal, ...campos } = datos;
      const despues = await tx.direccionCliente.update({
        where: { id: direccionId },
        data: { ...campos, tipo, principalDe: valorPrincipalDe(tipo, principal) },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "DireccionCliente",
        registroId: direccionId,
        accion: "ACTUALIZAR",
        antes: existente,
        despues,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la dirección." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

/**
 * Desactivar, no borrar.
 *
 * Una dirección puede estar citada por pedidos ya despachados. Borrarla
 * rompería la trazabilidad de a dónde fue esa carga; desactivarla la saca de
 * los selectores y deja el historial intacto.
 */
export async function desactivarDireccion(direccionId: string): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await direccionDeLaEmpresa(direccionId, empresaId);
  if (!existente) return { error: "La dirección no pertenece a la compañía activa." };

  await prisma.$transaction(async (tx) => {
    const despues = await tx.direccionCliente.update({
      where: { id: direccionId },
      // Deja de ser principal al desactivarse: una principal inactiva dejaría
      // al tipo sin principal utilizable, y el selector no la ofrecería igual.
      data: { activa: false, principalDe: null },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "DireccionCliente",
      registroId: direccionId,
      accion: "DESACTIVAR",
      antes: existente,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath(`/comercial/clientes/${existente.clienteId}`);
  return {};
}
