"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoTransportista } from "@/lib/correlativos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import {
  normalizarPlaca,
  validarConductor,
  validarTransportista,
  validarVehiculo,
} from "@/lib/transportistas";

export type EstadoFormulario = { error?: string };

function esDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function autorizar() {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." } as const;
  }
  return auth;
}

/**
 * El id del transportista llega del navegador en todas las acciones de
 * vehículos y conductores: se relee SIEMPRE acotado a la compañía activa antes
 * de colgarle nada.
 */
async function transportistaDeLaEmpresa(id: string, empresaId: string) {
  return prisma.transportista.findFirst({ where: { id, empresaId }, select: { id: true } });
}

export async function crearTransportista(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = {
    razonSocial: String(formData.get("razonSocial") ?? "").trim(),
    ruc: String(formData.get("ruc") ?? "").trim(),
    registroMtc: String(formData.get("registroMtc") ?? "").trim(),
  };
  const error = validarTransportista(datos);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoTransportista(tx, empresaId);
      const creado = await tx.transportista.create({
        data: {
          empresaId,
          codigo,
          razonSocial: datos.razonSocial,
          // Cadena vacía a NULL: con "" el índice único chocaría entre todos
          // los transportistas sin RUC, que es justo lo que NULL evita.
          ruc: datos.ruc || null,
          registroMtc: datos.registroMtc || null,
          telefono: String(formData.get("telefono") ?? "").trim() || null,
          email: String(formData.get("email") ?? "").trim() || null,
          contactoNombre: String(formData.get("contactoNombre") ?? "").trim() || null,
          notas: String(formData.get("notas") ?? "").trim() || null,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "Transportista",
        registroId: creado.id,
        accion: "CREAR",
        despues: creado,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ya existe un transportista con el RUC ${datos.ruc}.` };
    throw e;
  }

  revalidatePath("/logistica/transportistas");
  return {};
}

export async function actualizarTransportista(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = {
    razonSocial: String(formData.get("razonSocial") ?? "").trim(),
    ruc: String(formData.get("ruc") ?? "").trim(),
    registroMtc: String(formData.get("registroMtc") ?? "").trim(),
  };
  const error = validarTransportista(datos);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    const ok = await prisma.$transaction(async (tx) => {
      const antes = await tx.transportista.findFirst({ where: { id, empresaId } });
      if (!antes) return false;
      const despues = await tx.transportista.update({
        where: { id },
        data: {
          razonSocial: datos.razonSocial,
          ruc: datos.ruc || null,
          registroMtc: datos.registroMtc || null,
          telefono: String(formData.get("telefono") ?? "").trim() || null,
          email: String(formData.get("email") ?? "").trim() || null,
          contactoNombre: String(formData.get("contactoNombre") ?? "").trim() || null,
          notas: String(formData.get("notas") ?? "").trim() || null,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "Transportista",
        registroId: id,
        accion: "ACTUALIZAR",
        antes,
        despues,
        usuario: auth.usuario,
      });
      return true;
    });
    if (!ok) return { error: "El transportista no pertenece a la compañía activa." };
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ya existe un transportista con el RUC ${datos.ruc}.` };
    throw e;
  }

  revalidatePath("/logistica/transportistas");
  return {};
}

export async function alternarActivoTransportista(id: string, activo: boolean): Promise<void> {
  const auth = await autorizar();
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.transportista.findFirst({ where: { id, empresaId } });
    if (!antes) return;
    const despues = await tx.transportista.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "Transportista",
      registroId: id,
      accion: activo ? "ACTIVAR" : "DESACTIVAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });
  revalidatePath("/logistica/transportistas");
}

export async function agregarVehiculo(
  transportistaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const placa = normalizarPlaca(String(formData.get("placa") ?? ""));
  const error = validarVehiculo(placa);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  if (!(await transportistaDeLaEmpresa(transportistaId, empresaId))) {
    return { error: "El transportista no pertenece a la compañía activa." };
  }

  try {
    await prisma.transportistaVehiculo.create({
      data: {
        transportistaId,
        placa,
        descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      },
    });
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ese transportista ya tiene la placa ${placa}.` };
    throw e;
  }

  revalidatePath("/logistica/transportistas");
  return {};
}

export async function agregarConductor(
  transportistaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const datos = {
    nombres: String(formData.get("nombres") ?? "").trim(),
    dni: String(formData.get("dni") ?? "").trim(),
  };
  const error = validarConductor(datos);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  if (!(await transportistaDeLaEmpresa(transportistaId, empresaId))) {
    return { error: "El transportista no pertenece a la compañía activa." };
  }

  try {
    await prisma.transportistaConductor.create({
      data: {
        transportistaId,
        nombres: datos.nombres,
        dni: datos.dni,
        licencia: String(formData.get("licencia") ?? "").trim() || null,
      },
    });
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ese transportista ya tiene el DNI ${datos.dni}.` };
    throw e;
  }

  revalidatePath("/logistica/transportistas");
  return {};
}

// Baja lógica y no borrado: un vehículo o un conductor pueden figurar en guías
// ya emitidas, y esas guías no se reescriben.
export async function alternarActivoVehiculo(id: string, activo: boolean): Promise<void> {
  const auth = await autorizar();
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.transportistaVehiculo.updateMany({
    where: { id, transportista: { empresaId } },
    data: { activo },
  });
  revalidatePath("/logistica/transportistas");
}

export async function alternarActivoConductor(id: string, activo: boolean): Promise<void> {
  const auth = await autorizar();
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.transportistaConductor.updateMany({
    where: { id, transportista: { empresaId } },
    data: { activo },
  });
  revalidatePath("/logistica/transportistas");
}
