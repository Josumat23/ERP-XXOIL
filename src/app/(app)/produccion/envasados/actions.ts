"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoEnvasado } from "@/lib/correlativos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { normalizarInsumosEnvasado, type InsumoEnvasadoNormalizado } from "@/lib/insumosEnvasado";
import { postearAsiento } from "@/lib/contabilidad";

export type EstadoFormulario = { error?: string };


// Envasado: consume granel aprobado + envases/etiquetas y produce stock
// de la presentación. Todos los movimientos quedan en el kardex con el
// código del envasado como referencia.
export async function crearEnvasado(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const loteGranelId = String(formData.get("loteGranelId") ?? "");
  const presentacionId = String(formData.get("presentacionId") ?? "");
  const unidades = Number(formData.get("unidades"));
  const horasManoObra = Number(formData.get("horasManoObra") ?? 0);

  let insumosRaw: unknown;
  try {
    insumosRaw = JSON.parse(String(formData.get("insumos") ?? "[]"));
  } catch {
    return { error: "El detalle de envases/etiquetas es inválido." };
  }

  if (!loteGranelId) return { error: "Seleccione el lote granel." };
  if (!presentacionId) return { error: "Seleccione la presentación a envasar." };
  if (!Number.isInteger(unidades) || unidades <= 0) {
    return { error: "Las unidades deben ser un entero mayor a 0." };
  }
  if (!Number.isFinite(horasManoObra) || horasManoObra < 0) {
    return { error: "Las horas de mano de obra deben ser mayores o iguales a 0." };
  }
  const insumos: InsumoEnvasadoNormalizado[] | null = normalizarInsumosEnvasado(insumosRaw);
  if (insumos === null) {
    return { error: "El detalle de envases/etiquetas es inválido." };
  }

  const { tarifaHoraManoObra } = await obtenerConfiguracionEmpresa();
  const costoManoObra = horasManoObra * tarifaHoraManoObra.toNumber();

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findUnique({
        where: { id: loteGranelId },
        include: { formula: { include: { producto: true } } },
      });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "APROBADO") {
        throw new Error("Solo se puede envasar un lote aprobado por control de calidad.");
      }

      const presentacion = await tx.presentacion.findUnique({ where: { id: presentacionId } });
      if (!presentacion) throw new Error("La presentación no existe.");
      if (presentacion.productoId !== lote.formula.productoId) {
        throw new Error(
          `La presentación pertenece a otro producto: el lote es de ${lote.formula.producto.nombre}.`
        );
      }

      const kgConsumidos = unidades * presentacion.contenidoKg.toNumber();
      const disponibles = lote.kgDisponibles.toNumber();
      if (kgConsumidos > disponibles + 1e-9) {
        throw new Error(
          `Granel insuficiente: el lote tiene ${disponibles.toFixed(2)} kg disponibles y se requieren ${kgConsumidos.toFixed(2)} kg.`
        );
      }

      const reserva = await tx.loteGranel.updateMany({
        where: { id: loteGranelId, estado: "APROBADO", kgDisponibles: { gte: kgConsumidos } },
        data: { kgDisponibles: { decrement: kgConsumidos } },
      });
      if (reserva.count !== 1) {
        throw new Error("El saldo del lote cambio durante el envasado. Actualice la pagina e intente nuevamente.");
      }

      const codigo = await siguienteCodigoEnvasado(tx);

      const vidaUtilMeses = lote.formula.producto.vidaUtilMeses;
      const fecha = new Date();
      const fechaVencimiento = vidaUtilMeses
        ? new Date(fecha.getFullYear(), fecha.getMonth() + vidaUtilMeses, fecha.getDate())
        : null;

      const envasado = await tx.envasado.create({
        data: {
          codigo,
          loteGranelId,
          presentacionId,
          unidades,
          unidadesDisponibles: unidades,
          fecha,
          fechaVencimiento,
          kgConsumidos,
          horasManoObra,
          costoManoObra,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          insumos: {
            create: insumos.map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad })),
          },
        },
      });

      // Consumo de envases y etiquetas, acumulando su costo
      let costoEnvases = 0;
      for (const linea of insumos) {
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: linea.insumoId } });
        costoEnvases += linea.cantidad * insumo.costoUnitario.toNumber();

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: linea.insumoId,
          tipoMovimiento: "SALIDA",
          origen: "ENVASADO",
          cantidad: linea.cantidad,
          referencia: `Envasado ${envasado.codigo} (lote ${lote.codigo})`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      // Costo del envasado: granel consumido (al costo/kg del lote) + envases + mano de obra
      const costoTotal = kgConsumidos * lote.costoKg.toNumber() + costoEnvases + costoManoObra;
      const costoUnitario = costoTotal / unidades;

      await tx.envasado.update({
        where: { id: envasado.id },
        data: { costoTotal, costoUnitario },
      });
      const costoActualizado = await actualizarCostoPromedioEntrada(tx, {
        tipoItem: "PRESENTACION",
        itemId: presentacionId,
        stockActual: presentacion.stock,
        costoActual: presentacion.costoPromedio,
        cantidadEntrada: unidades,
        costoEntrada: costoUnitario,
      });
      if (!costoActualizado.ok) throw new Error(costoActualizado.error);

      // Entrada del producto terminado
      const entrada = await registrarMovimiento(tx, {
        tipoItem: "PRESENTACION",
        presentacionId,
        tipoMovimiento: "ENTRADA",
        origen: "ENVASADO",
        cantidad: unidades,
        referencia: `Envasado ${envasado.codigo} (lote ${lote.codigo})`,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!entrada.ok) throw new Error(entrada.error);

      await postearAsiento(tx, {
        origen: "ENVASADO_PRODUCCION",
        glosa: `Transferencia a producto terminado ${envasado.codigo}`,
        referencia: envasado.codigo,
        lineas: [
          { clave: "INVENTARIO_PT", debe: costoTotal },
          { clave: "WIP_PRODUCCION", haber: kgConsumidos * lote.costoKg.toNumber() },
          { clave: "INVENTARIO_INSUMOS", haber: costoEnvases },
          { clave: "COSTOS_PRODUCCION_APLICADOS", haber: costoManoObra },
        ],
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });

    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/envasados");
  revalidatePath("/produccion/lotes");
  redirect("/produccion/envasados");
}
