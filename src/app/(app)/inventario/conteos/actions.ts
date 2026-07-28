"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoConteo } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

type LineaConteo = { tipoItem: "PRESENTACION" | "INSUMO"; itemId: string; cantidadContada: number };

// Conteo cíclico: registra lo contado físicamente contra el saldo del
// sistema al momento de guardar, y genera un AJUSTE de kardex por cada línea
// con diferencia. Las líneas sin diferencia quedan igual en el detalle, pero
// no generan movimiento (no hay nada que corregir).
export async function crearConteo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  let lineas: LineaConteo[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del conteo es inválido." };
  }
  lineas = lineas.filter(
    (l) =>
      (l.tipoItem === "PRESENTACION" || l.tipoItem === "INSUMO") &&
      l.itemId &&
      Number.isFinite(l.cantidadContada) &&
      l.cantidadContada >= 0
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos un ítem con la cantidad contada." };
  }

  let conteoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoConteo(tx);
      const conteo = await tx.conteoInventario.create({
        data: { codigo, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
      });
      conteoId = conteo.id;

      for (const l of lineas) {
        const cantidadSistema =
          l.tipoItem === "PRESENTACION"
            ? (await tx.presentacion.findUniqueOrThrow({ where: { id: l.itemId } })).stock.toNumber()
            : (await tx.insumo.findUniqueOrThrow({ where: { id: l.itemId } })).stock.toNumber();
        const diferencia = l.cantidadContada - cantidadSistema;

        await tx.conteoInventarioDetalle.create({
          data: {
            conteoId: conteo.id,
            tipoItem: l.tipoItem,
            presentacionId: l.tipoItem === "PRESENTACION" ? l.itemId : null,
            insumoId: l.tipoItem === "INSUMO" ? l.itemId : null,
            cantidadSistema,
            cantidadContada: l.cantidadContada,
            diferencia,
          },
        });

        if (Math.abs(diferencia) > 1e-9) {
          const mov = await registrarMovimiento(tx, {
            tipoItem: l.tipoItem,
            presentacionId: l.tipoItem === "PRESENTACION" ? l.itemId : undefined,
            insumoId: l.tipoItem === "INSUMO" ? l.itemId : undefined,
            tipoMovimiento: diferencia > 0 ? "ENTRADA" : "SALIDA",
            origen: "AJUSTE",
            cantidad: Math.abs(diferencia),
            motivo: `Conteo cíclico ${codigo}`,
            referencia: codigo,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          });
          if (!mov.ok) throw new Error(mov.error);
        }
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/inventario/conteos");
  revalidatePath("/inventario/kardex");
  redirect(`/inventario/conteos/${conteoId}`);
}
