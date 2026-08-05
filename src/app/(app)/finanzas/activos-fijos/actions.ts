"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoActivoFijo } from "@/lib/correlativos";
import { postearVentaActivoFijo } from "@/lib/contabilidad";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { ejecutarDepreciacionDelMes } from "@/lib/depreciacion";

export type EstadoFormulario = { error?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

const CATEGORIAS_VALIDAS: $Enums.CategoriaActivoFijo[] = [
  "MAQUINARIA",
  "VEHICULO",
  "EQUIPO_OFICINA",
  "INMUEBLE",
  "OTRO",
];

export async function crearActivoFijo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Finanzas." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "") as $Enums.CategoriaActivoFijo;
  const almacenId = String(formData.get("almacenId") ?? "") || null;
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const fechaAdquisicionRaw = String(formData.get("fechaAdquisicion") ?? "");
  const costoAdquisicion = Number(formData.get("costoAdquisicion"));
  const valorResidual = Number(formData.get("valorResidual") ?? 0);
  const vidaUtilAnios = Number(formData.get("vidaUtilAnios"));
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const proyectoId = String(formData.get("proyectoId") ?? "") || null;

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!CATEGORIAS_VALIDAS.includes(categoria)) return { error: "Seleccione una categoría válida." };
  const fechaAdquisicion = fechaAdquisicionRaw ? new Date(fechaAdquisicionRaw) : null;
  if (!fechaAdquisicion || Number.isNaN(fechaAdquisicion.getTime())) {
    return { error: "La fecha de adquisición es obligatoria." };
  }
  if (!Number.isFinite(costoAdquisicion) || costoAdquisicion <= 0) {
    return { error: "El costo de adquisición debe ser mayor a 0." };
  }
  if (!Number.isFinite(valorResidual) || valorResidual < 0) {
    return { error: "El valor residual debe ser un número válido." };
  }
  if (valorResidual >= costoAdquisicion) {
    return { error: "El valor residual debe ser menor al costo de adquisición." };
  }
  if (!Number.isInteger(vidaUtilAnios) || vidaUtilAnios <= 0) {
    return { error: "La vida útil (años) debe ser un entero mayor a 0." };
  }

  await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoActivoFijo(tx);
    await tx.activoFijo.create({
      data: {
        codigo,
        nombre,
        categoria,
        almacenId,
        centroCostoId,
        fechaAdquisicion,
        costoAdquisicion,
        valorResidual,
        vidaUtilAnios,
        notas,
        proyectoId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });
  });

  revalidatePath("/finanzas/activos-fijos");
  if (proyectoId) revalidatePath(`/proyectos/${proyectoId}`);
  redirect("/finanzas/activos-fijos");
}

export async function darDeBajaActivoFijo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const motivoBaja = String(formData.get("motivoBaja") ?? "").trim();
  if (!motivoBaja) return { error: "El motivo de la baja es obligatorio." };

  const activo = await prisma.activoFijo.findUnique({ where: { id } });
  if (!activo) return { error: "El activo no existe." };
  if (!activo.activo) return { error: "Este activo ya fue dado de baja." };

  await prisma.activoFijo.update({
    where: { id },
    data: { activo: false, fechaBaja: new Date(), motivoBaja },
  });

  revalidatePath("/finanzas/activos-fijos");
  revalidatePath(`/finanzas/activos-fijos/${id}`);
  return {};
}

// Venta de un activo usado: además de darlo de baja, registra el ingreso de
// caja y postea la utilidad/pérdida frente al valor en libros (costo −
// depreciación acumulada a la fecha).
export async function venderActivoFijo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const precioVenta = Number(formData.get("precioVenta"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const motivoBaja = String(formData.get("motivoBaja") ?? "").trim() || "Venta del activo";

  if (!Number.isFinite(precioVenta) || precioVenta < 0) {
    return { error: "El precio de venta debe ser un número válido." };
  }
  if (!MEDIOS_VALIDOS.includes(medioPago)) {
    return { error: "Seleccione el medio de pago recibido." };
  }

  // El precio ingresado es el monto total cobrado (con IGV incluido, igual
  // que el precio que ve el comprador); se separa la base imponible del IGV
  // para el asiento, igual que en notas de crédito y facturas.
  const { tasaIgv } = await obtenerConfiguracionEmpresa();
  const montoBase = precioVenta / (1 + tasaIgv.toNumber() / 100);
  const montoIgv = precioVenta - montoBase;

  try {
    await prisma.$transaction(async (tx) => {
      const activo = await tx.activoFijo.findUnique({ where: { id } });
      if (!activo) throw new Error("El activo no existe.");
      if (!activo.activo) throw new Error("Este activo ya fue dado de baja.");

      await tx.activoFijo.update({
        where: { id },
        data: { activo: false, fechaBaja: new Date(), motivoBaja, precioVenta },
      });

      if (precioVenta > 0) {
        await tx.movimientoCaja.create({
          data: {
            tipo: "INGRESO",
            concepto: `Venta del activo ${activo.codigo} — ${activo.nombre}`,
            monto: precioVenta,
            medioPago,
            referencia: activo.codigo,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          },
        });
      }

      await postearVentaActivoFijo(
        tx,
        {
          codigoActivo: activo.codigo,
          nombreActivo: activo.nombre,
          costoAdquisicion: activo.costoAdquisicion.toNumber(),
          depreciacionAcumulada: activo.depreciacionAcumulada.toNumber(),
          montoBase,
          montoIgv,
          centroCostoId: activo.centroCostoId,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/finanzas/activos-fijos");
  revalidatePath(`/finanzas/activos-fijos/${id}`);
  revalidatePath("/finanzas/caja");
  return {};
}

// Depreciación en línea recta: un asiento consolidado por período, generado
// solo si aún hay activos con base depreciable pendiente. Se salta cualquier
// activo que ya tenga su cargo del mes (restricción única activoFijoId+anio+mes),
// para que el botón se pueda presionar varias veces sin duplicar el asiento.
export async function registrarDepreciacionMes(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: "Período inválido." };
  }

  try {
    const resultado = await prisma.$transaction((tx) =>
      ejecutarDepreciacionDelMes(tx, anio, mes, {
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      })
    );

    revalidatePath("/finanzas/activos-fijos");
    if (resultado.procesados === 0) {
      return { error: `No hay activos pendientes de depreciar para ${mes}/${anio}.` };
    }
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  return {};
}
