"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoConteo } from "@/lib/correlativos";
import { normalizarLineasConteo, type LineaConteoNormalizada } from "@/lib/lineasConteo";

export type EstadoFormulario = { error?: string };

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

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del conteo es inválido." };
  }
  const lineas: LineaConteoNormalizada[] | null = normalizarLineasConteo(lineasRaw);
  if (lineas === null) {
    return { error: "El detalle del conteo es inválido." };
  }
  if (lineas.length === 0) {
    return { error: "Agregue al menos un ítem con la cantidad contada." };
  }
  const itemsUnicos = new Set(lineas.map((linea) => `${linea.tipoItem}:${linea.itemId}`));
  if (itemsUnicos.size !== lineas.length) {
    return { error: "Hay ítems repetidos en el conteo." };
  }

  let conteoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoConteo(tx);
      const conteo = await tx.conteoInventario.create({
        data: { codigo, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
      });
      conteoId = conteo.id;

      for (const l of [...lineas].sort((a, b) =>
        `${a.tipoItem}:${a.itemId}`.localeCompare(`${b.tipoItem}:${b.itemId}`)
      )) {
        // La escritura neutra bloquea el saldo antes de calcular la diferencia;
        // todos los conteos adquieren varios ítems en el mismo orden.
        const cantidadSistema =
          l.tipoItem === "PRESENTACION"
            ? (
                await tx.presentacion.update({
                  where: { id: l.itemId },
                  data: { stock: { increment: 0 } },
                  select: { stock: true },
                })
              ).stock.toNumber()
            : (
                await tx.insumo.update({
                  where: { id: l.itemId },
                  data: { stock: { increment: 0 } },
                  select: { stock: true },
                })
              ).stock.toNumber();
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
