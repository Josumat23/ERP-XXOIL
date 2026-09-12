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
import { nombresDeUbigeo, resolverUbigeoEnTransaccion } from "@/lib/ubigeos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";
import {
  creacionRequiereAprobacion,
  decidirCambioLimiteCredito,
  MENSAJE_LIMITE_PENDIENTE,
} from "@/lib/aprobacionCredito";

// `aviso` no es un error: el cliente se guardó, pero el aumento del límite
// quedó pendiente. Sin él el usuario creería que el límite ya cambió.
export type EstadoFormulario = { error?: string; aviso?: string };

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
  const ubigeoId = String(formData.get("ubigeoId") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const contactoNombre = String(formData.get("contactoNombre") ?? "").trim() || null;
  const contactoTelefono = String(formData.get("contactoTelefono") ?? "").trim() || null;
  const zonaId = String(formData.get("zonaId") ?? "") || null;
  const vendedorId = String(formData.get("vendedorId") ?? "") || null;
  const limiteCredito = Number(formData.get("limiteCredito") ?? 0);
  const motivoLimiteCredito = String(formData.get("motivoLimiteCredito") ?? "").trim();
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
  if (motivoLimiteCredito.length > 500) {
    return { error: "El motivo del aumento no puede superar 500 caracteres." } as const;
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
      ubigeoId,
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
    // Fuera de `datos`: no es una columna del cliente, sino el sustento de la
    // solicitud de aumento cuando el control de crédito está encendido.
    motivoLimiteCredito,
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

  const empresaIdAlta = await obtenerEmpresaActivaId();
  const { montoAprobacionCredito } = await obtenerConfiguracionEmpresa(empresaIdAlta);
  const umbralAlta = montoAprobacionCredito?.toNumber() ?? null;
  if (creacionRequiereAprobacion(resultado.datos.limiteCredito, umbralAlta)) {
    return {
      error: `Un cliente nuevo no puede darse de alta con un límite que requiere aprobación (umbral: S/ ${umbralAlta}; 0 = sin límite). Créelo dentro del umbral y solicite el aumento desde su ficha.`,
    };
  }

  try {
    const empresaId = empresaIdAlta;
    await prisma.$transaction(async (tx) => {
      if (resultado.datos.zonaId && await tx.zona.count({ where: { id: resultado.datos.zonaId, empresaId, activo: true } }) !== 1) throw new Error("La zona no pertenece a la empresa activa.");
      if (resultado.datos.vendedorId && await tx.vendedor.count({ where: { id: resultado.datos.vendedorId, empresaId, activo: true } }) !== 1) throw new Error("El vendedor no pertenece a la empresa activa.");
      const ubigeo = await resolverUbigeoEnTransaccion(tx, resultado.datos.ubigeoId);
      const codigo = await siguienteCodigoCliente(tx, empresaId);
      const cliente = await tx.cliente.create({
        data: { ...resultado.datos, ...nombresDeUbigeo(ubigeo), codigo, empresaId },
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
  const { montoAprobacionCredito } = await obtenerConfiguracionEmpresa(empresaId);
  const umbral = montoAprobacionCredito?.toNumber() ?? null;
  try {
    const desenlace = await prisma.$transaction(async (tx) => {
      const antes = await tx.cliente.findUnique({ where: { id } });
      if (!perteneceAEmpresaActiva(antes, empresaId)) return "AJENO" as const;
      if (resultado.datos.zonaId && await tx.zona.count({ where: { id: resultado.datos.zonaId, empresaId, activo: true } }) !== 1) throw new Error("La zona no pertenece a la empresa activa.");
      if (resultado.datos.vendedorId && await tx.vendedor.count({ where: { id: resultado.datos.vendedorId, empresaId, activo: true } }) !== 1) throw new Error("El vendedor no pertenece a la empresa activa.");

      // El límite anterior se lee de la base, nunca del formulario: si la
      // decisión se tomara sobre el valor que manda el navegador, bastaría con
      // declarar un límite anterior alto para saltarse la aprobación.
      const decision = decidirCambioLimiteCredito(
        antes.limiteCredito.toNumber(),
        resultado.datos.limiteCredito,
        umbral
      );
      if (decision.requiereAprobacion) {
        if (!resultado.motivoLimiteCredito) return "SIN_MOTIVO" as const;
        const pendientes = await tx.solicitudCambioCredito.count({
          where: { clienteId: id, empresaId, estado: "PENDIENTE" },
        });
        if (pendientes > 0) return "YA_PENDIENTE" as const;
        await tx.solicitudCambioCredito.create({
          data: {
            empresaId,
            clienteId: id,
            limiteAnterior: antes.limiteCredito,
            limiteSolicitado: resultado.datos.limiteCredito,
            motivo: resultado.motivoLimiteCredito,
            solicitadoPorId: auth.usuario.id,
            solicitadoPorNombre: auth.usuario.nombre,
          },
        });
      }

      const ubigeo = await resolverUbigeoEnTransaccion(tx, resultado.datos.ubigeoId);
      const despues = await tx.cliente.update({
        where: { id, empresaId },
        data: {
          ...resultado.datos,
          ...nombresDeUbigeo(ubigeo),
          // El resto de la ficha sí se guarda; el límite se queda como estaba
          // hasta que la solicitud se resuelva.
          limiteCredito: decision.requiereAprobacion ? antes.limiteCredito : resultado.datos.limiteCredito,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId: despues.empresaId,
        entidad: "Cliente",
        registroId: id,
        accion: "ACTUALIZAR",
        antes,
        despues,
        usuario: auth.usuario,
      });
      return decision.requiereAprobacion ? ("PENDIENTE" as const) : ("OK" as const);
    });
    if (desenlace === "AJENO") return { error: "El cliente no pertenece a la compañía activa." };
    if (desenlace === "SIN_MOTIVO") {
      return { error: "Indique el motivo del aumento: es lo que va a leer quien tenga que aprobarlo." };
    }
    if (desenlace === "YA_PENDIENTE") {
      return { error: "Este cliente ya tiene una solicitud de aumento pendiente. Resuélvala antes de pedir otra." };
    }
    if (desenlace === "PENDIENTE") {
      // Sin redirección: el aviso se pierde si la pantalla cambia, y la
      // solicitud recién creada se ve en esta misma ficha.
      revalidatePath("/comercial/clientes");
      revalidatePath(`/comercial/clientes/${id}`);
      revalidatePath("/aprobaciones");
      return { aviso: MENSAJE_LIMITE_PENDIENTE };
    }
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un cliente con el documento ${resultado.datos.ruc}.` };
    }
    throw e;
  }

  revalidatePath("/comercial/clientes");
  redirect("/comercial/clientes");
}

// El id llega del navegador: la solicitud se busca SIEMPRE acotada a la
// compañía activa, y de ella sale el cliente al que se le aplica el límite —
// nunca de un id que mande el formulario.
async function resolverSolicitudCredito(
  id: string,
  aprobar: boolean,
  motivoResolucion: string | null
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver cambios de límite de crédito." };
  }
  const empresaId = await obtenerEmpresaActivaId();

  try {
    const desenlace = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudCambioCredito.findFirst({ where: { id, empresaId } });
      if (!solicitud || solicitud.estado !== "PENDIENTE") return "NO_PENDIENTE" as const;
      if (!puedeResolverSolicitud(solicitud.solicitadoPorId, auth.usuario.id)) {
        return "MISMO_USUARIO" as const;
      }

      // Cierre optimista: si otro usuario la resolvió entre la lectura y esta
      // escritura, count deja de ser 1 y el límite no se toca.
      const cerrada = await tx.solicitudCambioCredito.updateMany({
        where: { id, empresaId, estado: "PENDIENTE" },
        data: {
          estado: aprobar ? "APROBADA" : "RECHAZADA",
          resueltoPorId: auth.usuario.id,
          resueltoPorNombre: auth.usuario.nombre,
          resueltoEn: new Date(),
          motivoResolucion,
        },
      });
      if (cerrada.count !== 1) return "CARRERA" as const;

      if (aprobar) {
        const antes = await tx.cliente.findFirst({ where: { id: solicitud.clienteId, empresaId } });
        if (!antes) return "SIN_CLIENTE" as const;
        const despues = await tx.cliente.update({
          where: { id: antes.id, empresaId },
          data: { limiteCredito: solicitud.limiteSolicitado },
        });
        await registrarAuditoriaMaestro(tx, {
          empresaId,
          entidad: "Cliente",
          registroId: antes.id,
          accion: "ACTUALIZAR",
          antes,
          despues,
          usuario: auth.usuario,
        });
      }
      return { clienteId: solicitud.clienteId };
    });

    if (desenlace === "NO_PENDIENTE") return { error: "Esta solicitud no está pendiente." };
    if (desenlace === "MISMO_USUARIO") {
      return { error: "Quien pidió el aumento no puede aprobarlo ni rechazarlo." };
    }
    if (desenlace === "CARRERA") return { error: "La solicitud ya fue resuelta por otro usuario." };
    if (desenlace === "SIN_CLIENTE") return { error: "El cliente de la solicitud ya no existe." };

    revalidatePath("/aprobaciones");
    revalidatePath("/comercial/clientes");
    revalidatePath(`/comercial/clientes/${desenlace.clienteId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo resolver la solicitud." };
  }
}

export async function aprobarCambioLimiteCredito(id: string): Promise<EstadoFormulario> {
  return resolverSolicitudCredito(id, true, null);
}

export async function rechazarCambioLimiteCredito(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };
  if (motivo.length > 500) return { error: "El motivo no puede superar 500 caracteres." };
  return resolverSolicitudCredito(id, false, motivo);
}

export async function alternarActivoCliente(id: string, activo: boolean) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.cliente.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.cliente.update({ where: { id, empresaId }, data: { activo } });
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
