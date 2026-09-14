"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { MENSAJE_ERROR_CONTACTO, validarContacto } from "@/lib/contactosCliente";

export type EstadoFormulario = { error?: string };

async function autorizar() {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." } as const;
  }
  return auth;
}

function leer(formData: FormData) {
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;
  return {
    nombres: String(formData.get("nombres") ?? "").trim(),
    apellidos: texto("apellidos"),
    cargo: texto("cargo"),
    area: texto("area"),
    telefono: texto("telefono"),
    anexo: texto("anexo"),
    celular: texto("celular"),
    email: texto("email"),
    paraPedidos: formData.get("paraPedidos") === "on",
    paraFacturacion: formData.get("paraFacturacion") === "on",
    paraCobranza: formData.get("paraCobranza") === "on",
    paraDespacho: formData.get("paraDespacho") === "on",
    notas: texto("notas"),
    principal: formData.get("principal") === "on",
    activo: formData.get("activo") !== "off",
  };
}

/**
 * Deja un solo principal.
 *
 * El índice único ya impide dos, pero rechazaría la escritura en vez de
 * reemplazar, y reemplazar es lo que quien edita está pidiendo. Ocurre dentro
 * de la misma transacción: no hay un instante con dos ni con ninguno.
 *
 * Se escribe `null` y no `false`, porque el índice depende de que los no
 * principales queden nulos — dos `false` chocarían entre sí.
 */
async function liberarPrincipal(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clienteId: string,
  exceptoId?: string
) {
  await tx.contactoCliente.updateMany({
    where: { clienteId, esPrincipal: true, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
    data: { esPrincipal: null },
  });
}

export async function crearContacto(
  clienteId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = validarContacto(datos);
  if (error) return { error: MENSAJE_ERROR_CONTACTO[error] };

  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del navegador: se relee acotado a la compañía activa.
      const cliente = await tx.cliente.findFirst({ where: { id: clienteId, empresaId } });
      if (!cliente) throw new Error("El cliente no pertenece a la compañía activa.");

      if (datos.principal) await liberarPrincipal(tx, clienteId);

      const { principal, ...campos } = datos;
      const creado = await tx.contactoCliente.create({
        data: { ...campos, empresaId, clienteId, esPrincipal: principal ? true : null },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "ContactoCliente",
        registroId: creado.id,
        accion: "CREAR",
        despues: creado,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el contacto." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

export async function actualizarContacto(
  contactoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = leer(formData);
  const error = validarContacto(datos);
  if (error) return { error: MENSAJE_ERROR_CONTACTO[error] };

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await prisma.contactoCliente.findFirst({
    where: { id: contactoId, empresaId, cliente: { empresaId } },
  });
  if (!existente) return { error: "El contacto no pertenece a la compañía activa." };

  const clienteId = existente.clienteId;

  try {
    await prisma.$transaction(async (tx) => {
      if (datos.principal) await liberarPrincipal(tx, clienteId, contactoId);

      const { principal, ...campos } = datos;
      const despues = await tx.contactoCliente.update({
        where: { id: contactoId },
        data: { ...campos, esPrincipal: principal ? true : null },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "ContactoCliente",
        registroId: contactoId,
        accion: "ACTUALIZAR",
        antes: existente,
        despues,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el contacto." };
  }

  revalidatePath(`/comercial/clientes/${clienteId}`);
  return {};
}

/**
 * Desactivar, no borrar.
 *
 * El histórico dice a quién se le avisó y cuándo. Borrar a la persona deja
 * esos registros hablando de un nombre que ya no existe.
 */
export async function desactivarContacto(contactoId: string): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const empresaId = await obtenerEmpresaActivaId();
  const existente = await prisma.contactoCliente.findFirst({
    where: { id: contactoId, empresaId, cliente: { empresaId } },
  });
  if (!existente) return { error: "El contacto no pertenece a la compañía activa." };

  await prisma.$transaction(async (tx) => {
    const despues = await tx.contactoCliente.update({
      where: { id: contactoId },
      // Deja de ser principal: uno inactivo dejaría al cliente sin principal
      // utilizable, y la ficha lo seguiría mostrando como el referente.
      data: { activo: false, esPrincipal: null },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "ContactoCliente",
      registroId: contactoId,
      accion: "DESACTIVAR",
      antes: existente,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath(`/comercial/clientes/${existente.clienteId}`);
  return {};
}
