"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoEnvasado } from "@/lib/correlativos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { normalizarInsumosEnvasado, type InsumoEnvasadoNormalizado } from "@/lib/insumosEnvasado";
import { postearAsiento } from "@/lib/contabilidad";
import { MENSAJE_ERROR_REANALISIS, validarReanalisis } from "@/lib/reanalisis";
import {
  normalizarLecturasCalidad,
  resultadosDelEnsayo,
  type ResultadoDeEnsayo,
} from "@/lib/planesCalidad";

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

  const { tarifaHoraManoObra } = await obtenerConfiguracionEmpresa(auth.usuario.empresaId);
  const costoManoObra = horasManoObra * tarifaHoraManoObra.toNumber();

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findFirst({
        where: { id: loteGranelId, empresaId: auth.usuario.empresaId },
        include: { formula: { include: { producto: true } } },
      });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "APROBADO") {
        throw new Error("Solo se puede envasar un lote aprobado por control de calidad.");
      }

      const presentacion = await tx.presentacion.findFirst({
        where: { id: presentacionId, empresaId: auth.usuario.empresaId, activo: true },
      });
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
        where: { id: loteGranelId, empresaId: auth.usuario.empresaId, estado: "APROBADO", kgDisponibles: { gte: kgConsumidos } },
        data: { kgDisponibles: { decrement: kgConsumidos } },
      });
      if (reserva.count !== 1) {
        throw new Error("El saldo del lote cambio durante el envasado. Actualice la pagina e intente nuevamente.");
      }

      const codigo = await siguienteCodigoEnvasado(tx, auth.usuario.empresaId);

      const vidaUtilMeses = lote.formula.producto.vidaUtilMeses;
      const fecha = new Date();
      const fechaVencimiento = vidaUtilMeses
        ? new Date(fecha.getFullYear(), fecha.getMonth() + vidaUtilMeses, fecha.getDate())
        : null;

      const envasado = await tx.envasado.create({
        data: {
          empresaId: auth.usuario.empresaId,
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
        const insumo = await tx.insumo.findFirst({
          where: {
            id: linea.insumoId,
            empresaId: auth.usuario.empresaId,
            activo: true,
            tipo: { in: ["ENVASE", "ETIQUETA"] },
          },
        });
        if (!insumo) throw new Error("Un insumo de envasado no pertenece a la empresa activa.");
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
        empresaId: lote.empresaId,
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

/**
 * Registra un re-análisis de vigencia sobre un lote envasado.
 *
 * Un lubricante no se echa a perder al llegar su fecha: el laboratorio lo
 * vuelve a ensayar y, si sigue en especificación, le da vigencia nueva. Sin
 * esto `vidaUtilMeses` vence duro y obliga a castigar stock bueno.
 *
 * **No es cambiar una fecha.** El evento conserva el vencimiento anterior,
 * quién ensayó, contra qué plan y con qué resultado — extender un vencimiento
 * sin dejar rastro es exactamente lo que una auditoría de calidad busca.
 */
export async function registrarReanalisis(
  envasadoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const resultadoDeclarado = String(formData.get("resultado") ?? "");
  if (resultadoDeclarado !== "APROBADO" && resultadoDeclarado !== "RECHAZADO") {
    return { error: "Seleccione el resultado del ensayo." };
  }
  const crudo = String(formData.get("vencimientoNuevo") ?? "").trim();
  if (!crudo) return { error: "Indique el vencimiento nuevo." };
  // `new Date("2027-03-01")` se interpreta en UTC y en Perú cae un día antes.
  const [anio, mes, dia] = crudo.split("-").map(Number);
  const vencimientoNuevo = new Date(anio, (mes ?? 1) - 1, dia ?? 1);
  if (Number.isNaN(vencimientoNuevo.getTime())) return { error: "El vencimiento no es una fecha válida." };

  const planInspeccionId = String(formData.get("planInspeccionId") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const empresaId = auth.usuario.empresaId;

  try {
    await prisma.$transaction(async (tx) => {
      const envasado = await tx.envasado.findFirst({ where: { id: envasadoId, empresaId } });
      if (!envasado) throw new Error("El envasado no existe o no es de la compañía activa.");

      // El plan tiene que ser de la compañía activa: no se confía en el id que
      // llega del formulario.
      let planVersion: number | null = null;
      let resultados: ResultadoDeEnsayo[] = [];
      let resultado: "APROBADO" | "RECHAZADO" = resultadoDeclarado;
      if (planInspeccionId) {
        const plan = await tx.planInspeccionCalidad.findFirst({
          where: { id: planInspeccionId, empresaId },
          include: { caracteristicas: { orderBy: { secuencia: "asc" } } },
        });
        if (!plan) throw new Error("El plan de inspección no pertenece a la compañía activa.");
        planVersion = plan.version;

        resultados = resultadosDelEnsayo(
          plan.caracteristicas.map((c) => ({
            ...c,
            limiteInferior: c.limiteInferior === null ? null : c.limiteInferior.toNumber(),
            limiteSuperior: c.limiteSuperior === null ? null : c.limiteSuperior.toNumber(),
          })),
          normalizarLecturasCalidad(String(formData.get("lecturas") ?? "[]"))
        );
        if (resultados.length === 0) {
          throw new Error(
            "Declaró un plan de inspección pero no registró ninguna medición. Un re-análisis sin mediciones no es un ensayo."
          );
        }

        // El resultado NO lo elige quien carga: sale de las mediciones contra
        // la especificación del plan. Dejarlo a criterio del formulario
        // permitiría aprobar un re-análisis cuyas propias lecturas están fuera
        // de rango, que es la contradicción que este registro existe para
        // impedir.
        resultado = resultados.every((r) => r.conforme) ? "APROBADO" : "RECHAZADO";

        // Los instrumentos llegan del navegador: se comprueban antes de
        // asentar el ensayo.
        const instrumentosUsados = [
          ...new Set(resultados.map((r) => r.instrumentoId).filter((x): x is string => x !== null)),
        ];
        if (instrumentosUsados.length > 0) {
          const propios = await tx.instrumentoMedicion.count({
            where: { id: { in: instrumentosUsados }, empresaId },
          });
          if (propios !== instrumentosUsados.length) {
            throw new Error("Algún instrumento no pertenece a la compañía activa.");
          }
        }
      }

      const error = validarReanalisis({
        vencimientoActual: envasado.fechaVencimiento,
        vencimientoNuevo,
        resultado,
        unidadesDisponibles: envasado.unidadesDisponibles,
      });
      if (error) throw new Error(MENSAJE_ERROR_REANALISIS[error]);

      await tx.reanalisisEnvasado.create({
        data: {
          empresaId,
          envasadoId,
          vencimientoAnterior: envasado.fechaVencimiento!,
          vencimientoNuevo,
          resultado,
          planInspeccionId,
          planVersion,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          // Qué dio el re-ensayo. Sin esto, extender una vigencia es una
          // afirmación sin evidencia.
          resultadosCaracteristica: { create: resultados },
        },
      });

      await tx.envasado.update({
        where: { id: envasadoId },
        data: { fechaVencimiento: vencimientoNuevo },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el re-análisis." };
  }

  revalidatePath(`/produccion/envasados/${envasadoId}`);
  return {};
}
