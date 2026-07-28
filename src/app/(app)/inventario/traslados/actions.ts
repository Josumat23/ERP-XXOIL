"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoTraslado } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string; ok?: boolean };

// Traslado entre almacenes: una SALIDA en el origen + una ENTRADA en el
// destino, con la misma referencia, dentro de una sola transacción. Si el
// origen no tiene stock suficiente, ninguna de las dos se aplica.
export async function crearTraslado(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const itemCompuesto = String(formData.get("item") ?? ""); // "PRESENTACION:id" | "INSUMO:id"
  const almacenOrigenId = String(formData.get("almacenOrigenId") ?? "");
  const almacenDestinoId = String(formData.get("almacenDestinoId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  const [tipoItem, itemId] = itemCompuesto.split(":");
  if ((tipoItem !== "PRESENTACION" && tipoItem !== "INSUMO") || !itemId) {
    return { error: "Seleccione el ítem a trasladar." };
  }
  if (!almacenOrigenId || !almacenDestinoId) {
    return { error: "Seleccione el almacén de origen y el de destino." };
  }
  if (almacenOrigenId === almacenDestinoId) {
    return { error: "El almacén de origen y el de destino deben ser distintos." };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un número mayor a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const referencia = await siguienteCodigoTraslado(tx);

      const salida = await registrarMovimiento(tx, {
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? itemId : undefined,
        insumoId: tipoItem === "INSUMO" ? itemId : undefined,
        tipoMovimiento: "SALIDA",
        origen: "TRASLADO",
        cantidad,
        referencia,
        motivo: motivo || undefined,
        almacenId: almacenOrigenId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!salida.ok) throw new Error(salida.error);

      const entrada = await registrarMovimiento(tx, {
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? itemId : undefined,
        insumoId: tipoItem === "INSUMO" ? itemId : undefined,
        tipoMovimiento: "ENTRADA",
        origen: "TRASLADO",
        cantidad,
        referencia,
        motivo: motivo || undefined,
        almacenId: almacenDestinoId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!entrada.ok) throw new Error(entrada.error);
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/inventario/traslados");
  revalidatePath("/inventario/kardex");
  return { ok: true };
}
