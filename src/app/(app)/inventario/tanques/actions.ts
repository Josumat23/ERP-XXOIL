"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { descargarEnTanque } from "@/lib/tanquesServicio";

export type EstadoFormulario = { error?: string; ok?: boolean };

function leerDatos(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const almacenId = String(formData.get("almacenId") ?? "");
  const insumoId = String(formData.get("insumoId") ?? "");
  const capacidadKg = Number(formData.get("capacidadKg"));

  if (!codigo || !nombre || !almacenId || !insumoId) {
    return { error: "Código, nombre, almacén e insumo son obligatorios." } as const;
  }
  if (!Number.isFinite(capacidadKg) || capacidadKg <= 0) {
    return { error: "La capacidad debe ser mayor a 0 kg." } as const;
  }

  return { datos: { codigo, nombre, almacenId, insumoId, capacidadKg } } as const;
}

export async function crearTanque(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const leido = leerDatos(formData);
  if ("error" in leido) return leido;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El almacén y el insumo tienen que ser de la compañía activa: no se
      // confía en los identificadores que llegan del formulario.
      if ((await tx.almacen.count({ where: { id: leido.datos.almacenId, empresaId } })) !== 1) {
        throw new Error("El almacén no pertenece a la compañía activa.");
      }
      if ((await tx.insumo.count({ where: { id: leido.datos.insumoId, empresaId } })) !== 1) {
        throw new Error("El insumo no pertenece a la compañía activa.");
      }
      const registro = await tx.tanque.create({ data: { ...leido.datos, empresaId } });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "Tanque",
        registroId: registro.id,
        accion: "CREAR",
        despues: registro,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe un tanque con el código "${leido.datos.codigo}".` };
    }
    return { error: e instanceof Error ? e.message : "No se pudo crear el tanque." };
  }

  revalidatePath("/inventario/tanques");
  return { ok: true };
}

/**
 * Descarga una recepción dentro de un tanque.
 *
 * A partir de acá el contenido está MEZCLADO y ningún kilo que salga se puede
 * atribuir a una sola recepción — por eso el consumo se reparte en proporción.
 * Ver `src/lib/tanques.ts`.
 */
export async function descargarRecepcion(
  tanqueId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const recepcionCompraDetalleId = String(formData.get("recepcionCompraDetalleId") ?? "");
  const cantidadKg = Number(formData.get("cantidadKg"));
  if (!recepcionCompraDetalleId) return { error: "Seleccione la recepción a descargar." };
  if (!Number.isFinite(cantidadKg) || cantidadKg <= 0) {
    return { error: "La cantidad debe ser mayor a 0 kg." };
  }

  const empresaId = await obtenerEmpresaActivaId();

  try {
    const resultado = await prisma.$transaction((tx) =>
      descargarEnTanque(tx, { tanqueId, recepcionCompraDetalleId, cantidadKg, empresaId })
    );
    if (!resultado.ok) return { error: resultado.error };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo descargar." };
  }

  revalidatePath("/inventario/tanques");
  revalidatePath(`/inventario/tanques/${tanqueId}`);
  return { ok: true };
}
