"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoUnidadManipulacion } from "@/lib/correlativos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  MENSAJE_ERROR_ARMADO,
  repartoEnZona,
  validarArmado,
  validarCodigo,
} from "@/lib/unidadesManipulacion";

export type EstadoFormulario = { error?: string };

const TIPOS: $Enums.TipoUnidadManipulacion[] = ["PALLET", "CAJA", "CONTENEDOR", "JAULA"];

async function autorizar() {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." } as const;
  }
  return auth;
}

export async function crearUnidad(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const tipoRaw = String(formData.get("tipo") ?? "PALLET");
  const tipo = TIPOS.find((t) => t === tipoRaw);
  if (!tipo) return { error: "Seleccione un tipo de unidad válido." };

  const codigoIngresado = String(formData.get("codigo") ?? "").trim();
  if (codigoIngresado) {
    const error = validarCodigo(codigoIngresado);
    if (error) return { error };
  }
  const zonaAlmacenId = String(formData.get("zonaAlmacenId") ?? "").trim();
  if (!zonaAlmacenId) return { error: "Elija la zona donde se arma la unidad." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // La zona llega del navegador: tiene que ser de un almacén de la
      // compañía activa.
      const zona = await tx.zonaAlmacen.findFirst({
        where: { id: zonaAlmacenId, activo: true, almacen: { empresaId } },
        select: { id: true },
      });
      if (!zona) throw new Error("La zona no pertenece a la compañía activa.");

      const codigo = codigoIngresado || (await siguienteCodigoUnidadManipulacion(tx, empresaId));
      await tx.unidadManipulacion.create({
        data: {
          empresaId,
          codigo,
          tipo,
          zonaAlmacenId,
          notas: String(formData.get("notas") ?? "").trim() || null,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una unidad con el código ${codigoIngresado}.` };
    }
    return { error: e instanceof Error ? e.message : "No se pudo crear la unidad." };
  }

  revalidatePath("/logistica/unidades-manipulacion");
  return {};
}

/**
 * Subir stock a una HU.
 *
 * NO cambia ningún saldo: lo que sube ya estaba contado en el saldo de la
 * zona. Lo único que cambia es que deja de estar suelto y pasa a estar sobre
 * la unidad.
 */
export async function cargarUnidad(
  unidadId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const presentacionId = String(formData.get("presentacionId") ?? "").trim();
  if (!presentacionId) return { error: "Elija la presentación a cargar." };
  const cantidad = Number(formData.get("cantidad"));

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // El id de la unidad llega del navegador: se relee acotado a la compañía.
      const unidad = await tx.unidadManipulacion.findFirst({
        where: { id: unidadId, empresaId },
        include: { zona: { select: { id: true, almacenId: true } } },
      });
      if (!unidad) throw new Error("La unidad no pertenece a la compañía activa.");
      if (unidad.estado === "EN_PLAYA") {
        throw new Error("La unidad ya está en la playa de despacho: no admite carga nueva.");
      }
      if (!unidad.zona) throw new Error(MENSAJE_ERROR_ARMADO.SIN_ZONA);

      const presentacion = await tx.presentacion.findFirst({
        where: { id: presentacionId, empresaId },
        select: { id: true },
      });
      if (!presentacion) throw new Error("La presentación no pertenece a la compañía activa.");

      const [saldo, contenidosDeLaZona] = await Promise.all([
        tx.saldoZona.findFirst({
          where: { zonaAlmacenId: unidad.zona.id, itemId: presentacionId },
        }),
        // Todo lo que ya está sobre unidades de ESTA zona: es lo que descuenta
        // del suelto disponible.
        tx.unidadManipulacionContenido.findMany({
          where: { presentacionId, unidad: { zonaAlmacenId: unidad.zona.id } },
        }),
      ]);

      const reparto = repartoEnZona(
        saldo?.cantidad.toNumber() ?? 0,
        contenidosDeLaZona.map((c) => ({
          presentacionId: c.presentacionId,
          cantidad: c.cantidad.toNumber(),
        })),
        presentacionId
      );
      const error = validarArmado(true, reparto, cantidad);
      if (error) throw new Error(MENSAJE_ERROR_ARMADO[error]);

      const existente = contenidosDeLaZona.find((c) => c.unidadId === unidadId);
      if (existente) {
        // Reclamo optimista sobre la cantidad leída, como el reparto entre
        // zonas.
        const reclamo = await tx.unidadManipulacionContenido.updateMany({
          where: { id: existente.id, cantidad: existente.cantidad },
          data: { cantidad: { increment: cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El contenido de la unidad cambió. Intente nuevamente.");
        }
      } else {
        await tx.unidadManipulacionContenido.create({
          data: { unidadId, presentacionId, cantidad },
        });
      }

      await tx.unidadManipulacion.update({
        where: { id: unidadId },
        data: { estado: "EN_ALMACEN" },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cargar la unidad." };
  }

  revalidatePath("/logistica/unidades-manipulacion");
  return {};
}

/**
 * Mover una HU completa a otra zona.
 *
 * Acá sí se mueve el saldo por zona: el pallet y todo lo que lleva encima
 * cambian de lugar. El saldo del almacén no se toca — sigue siendo el mismo
 * stock en el mismo almacén.
 */
export async function moverUnidad(
  unidadId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const destinoId = String(formData.get("zonaDestinoId") ?? "").trim();
  if (!destinoId) return { error: "Elija la zona de destino." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const unidad = await tx.unidadManipulacion.findFirst({
        where: { id: unidadId, empresaId },
        include: { contenidos: true, zona: { select: { id: true, almacenId: true } } },
      });
      if (!unidad) throw new Error("La unidad no pertenece a la compañía activa.");
      if (!unidad.zona) throw new Error("La unidad no está en una zona: no hay de dónde moverla.");
      if (unidad.zona.id === destinoId) throw new Error("La unidad ya está en esa zona.");

      const destino = await tx.zonaAlmacen.findFirst({
        where: { id: destinoId, activo: true, almacen: { empresaId } },
        select: { id: true, almacenId: true },
      });
      if (!destino) throw new Error("La zona de destino no pertenece a la compañía activa.");
      // Mover entre almacenes es un traslado, con su kardex y su documento.
      // Arrastrar el saldo de un almacén a otro por acá sería moverlo sin
      // dejar rastro en el kardex.
      if (destino.almacenId !== unidad.zona.almacenId) {
        throw new Error(
          "La zona de destino es de otro almacén. Un movimiento entre almacenes es un traslado, no un cambio de ubicación."
        );
      }

      for (const contenido of unidad.contenidos) {
        const cantidad = contenido.cantidad.toNumber();
        if (cantidad <= 0) continue;

        const origen = await tx.saldoZona.findFirst({
          where: { zonaAlmacenId: unidad.zona.id, itemId: contenido.presentacionId },
        });
        if (!origen || origen.cantidad.toNumber() < cantidad) {
          throw new Error("El saldo de la zona de origen no alcanza para mover la unidad.");
        }
        const reclamo = await tx.saldoZona.updateMany({
          where: { id: origen.id, cantidad: origen.cantidad },
          data: { cantidad: { decrement: cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El saldo de la zona cambió durante el movimiento. Intente nuevamente.");
        }

        const saldoDestino = await tx.saldoZona.findFirst({
          where: { zonaAlmacenId: destinoId, itemId: contenido.presentacionId },
        });
        if (saldoDestino) {
          const suma = await tx.saldoZona.updateMany({
            where: { id: saldoDestino.id, cantidad: saldoDestino.cantidad },
            data: { cantidad: { increment: cantidad } },
          });
          if (suma.count !== 1) {
            throw new Error("El saldo de la zona destino cambió. Intente nuevamente.");
          }
        } else {
          await tx.saldoZona.create({
            data: {
              zonaAlmacenId: destinoId,
              tipoItem: "PRESENTACION",
              itemId: contenido.presentacionId,
              presentacionId: contenido.presentacionId,
              cantidad,
            },
          });
        }
      }

      await tx.unidadManipulacion.update({
        where: { id: unidadId },
        data: { zonaAlmacenId: destinoId },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo mover la unidad." };
  }

  revalidatePath("/logistica/unidades-manipulacion");
  return {};
}

/**
 * Desarmar: el contenido vuelve a estar suelto en la zona donde está la HU.
 *
 * Tampoco cambia ningún saldo — es la operación inversa de cargar.
 */
export async function desarmarUnidad(
  unidadId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const unidad = await tx.unidadManipulacion.findFirst({
        where: { id: unidadId, empresaId },
        select: { id: true, zonaAlmacenId: true },
      });
      if (!unidad) throw new Error("La unidad no pertenece a la compañía activa.");
      if (!unidad.zonaAlmacenId) {
        throw new Error(
          "La unidad no está en una zona: su contenido no tiene dónde volver. Devuélvala a una zona primero."
        );
      }
      await tx.unidadManipulacionContenido.deleteMany({ where: { unidadId } });
      await tx.unidadManipulacion.update({
        where: { id: unidadId },
        data: { estado: "VACIA", notas: String(formData.get("notas") ?? "").trim() || undefined },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo desarmar la unidad." };
  }

  revalidatePath("/logistica/unidades-manipulacion");
  return {};
}
