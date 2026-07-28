"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

// Ledger manual de cascos (envases retornables): no se deriva automáticamente
// de las ventas porque un envasado no siempre implica un casco nuevo
// entregado (podría ser un refill de uno que el cliente ya tiene).
export async function registrarMovimientoCasco(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const clienteId = String(formData.get("clienteId") ?? "");
  const insumoId = String(formData.get("insumoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!insumoId) return { error: "Seleccione el envase retornable." };
  if (tipo !== "ENTREGADO" && tipo !== "DEVUELTO") {
    return { error: "Seleccione si el movimiento es entrega o devolución." };
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un entero mayor a 0." };
  }

  await prisma.movimientoCasco.create({
    data: {
      clienteId,
      insumoId,
      tipo,
      cantidad,
      referencia,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath("/comercial/cascos");
  return {};
}
