"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { registrarMovimiento } from "@/lib/inventario";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoInsumo[] = ["MATERIA_PRIMA", "ENVASE", "ETIQUETA"];

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoInsumo;
  const unidadMedida = String(formData.get("unidadMedida") ?? "").trim();
  const proveedorId = String(formData.get("proveedorId") ?? "") || null;
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);
  const costoUnitario = Number(formData.get("costoUnitario") ?? 0);
  const plazoEntregaDias = Number(formData.get("plazoEntregaDias") ?? 0);
  const cantidadMinimaCompra = Number(formData.get("cantidadMinimaCompra") ?? 0);
  const multiploCompra = Number(formData.get("multiploCompra") ?? 0);
  const codigoProveedor = String(formData.get("codigoProveedor") ?? "").trim() || null;
  const zonaAlmacenId = String(formData.get("zonaAlmacenId") ?? "") || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const requiereInspeccion = formData.get("requiereInspeccion") === "on";
  const esRetornable = formData.get("esRetornable") === "on";
  const montoDepositoRaw = String(formData.get("montoDeposito") ?? "").trim();
  const montoDeposito = montoDepositoRaw ? Number(montoDepositoRaw) : null;
  const esPeligroso = formData.get("esPeligroso") === "on";
  const claseGhs = String(formData.get("claseGhs") ?? "").trim() || null;

  if (!codigo || !nombre || !unidadMedida || !TIPOS_VALIDOS.includes(tipo)) {
    return { error: "Código, nombre, tipo y unidad de medida son obligatorios." } as const;
  }
  if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock mínimo debe ser un número válido." } as const;
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    return { error: "El costo unitario debe ser un número válido." } as const;
  }
  if (!Number.isInteger(plazoEntregaDias) || plazoEntregaDias < 0 || plazoEntregaDias > 3650) {
    return { error: "El plazo de entrega debe ser un número entero entre 0 y 3650 días." } as const;
  }
  if (!Number.isFinite(cantidadMinimaCompra) || cantidadMinimaCompra < 0 || !Number.isFinite(multiploCompra) || multiploCompra < 0) {
    return { error: "La compra mínima y el múltiplo deben ser números válidos no negativos." } as const;
  }
  if (montoDeposito !== null && (!Number.isFinite(montoDeposito) || montoDeposito < 0)) {
    return { error: "El monto del depósito debe ser un número válido." } as const;
  }

  return {
    datos: {
      codigo,
      nombre,
      tipo,
      unidadMedida,
      proveedorId,
      stockMinimo,
      costoUnitario,
      plazoEntregaDias,
      cantidadMinimaCompra,
      multiploCompra,
      codigoProveedor,
      zonaAlmacenId,
      notas,
      requiereInspeccion,
      esRetornable,
      montoDeposito,
      esPeligroso,
      claseGhs,
      moneda: "PEN",
    },
  } as const;
}

export async function crearInsumo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;
  const empresaId = await obtenerEmpresaActivaId();

  const stockInicial = Number(formData.get("stock") ?? 0);
  if (!Number.isFinite(stockInicial) || stockInicial < 0) {
    return { error: "El stock inicial debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (resultado.datos.proveedorId && await tx.proveedor.count({ where: { id: resultado.datos.proveedorId, empresaId } }) !== 1) throw new Error("El proveedor no pertenece a la empresa activa.");
      if (resultado.datos.zonaAlmacenId && await tx.zonaAlmacen.count({ where: { id: resultado.datos.zonaAlmacenId, almacen: { empresaId } } }) !== 1) throw new Error("La ubicación no pertenece a la empresa activa.");
      const creado = await tx.insumo.create({ data: { ...resultado.datos, empresaId } });
      await registrarAuditoriaMaestro(tx, { entidad: "Insumo", registroId: creado.id, accion: "CREAR", despues: creado, usuario: auth.usuario });
      if (stockInicial > 0) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: creado.id,
          tipoMovimiento: "ENTRADA",
          origen: "STOCK_INICIAL",
          cantidad: stockInicial,
          referencia: "Alta de insumo",
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un insumo con el código "${resultado.datos.codigo}".` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/catalogo/insumos");
  redirect("/catalogo/insumos");
}

// La edición nunca toca el stock: eso solo ocurre vía kardex.
export async function actualizarInsumo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.insumo.findFirstOrThrow({ where: { id, empresaId } });
      if (resultado.datos.proveedorId && await tx.proveedor.count({ where: { id: resultado.datos.proveedorId, empresaId } }) !== 1) throw new Error("El proveedor no pertenece a la empresa activa.");
      if (resultado.datos.zonaAlmacenId && await tx.zonaAlmacen.count({ where: { id: resultado.datos.zonaAlmacenId, almacen: { empresaId } } }) !== 1) throw new Error("La ubicación no pertenece a la empresa activa.");
      const despues = await tx.insumo.update({ where: { id, empresaId }, data: resultado.datos });
      await registrarAuditoriaMaestro(tx, { entidad: "Insumo", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un insumo con el código "${resultado.datos.codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/insumos");
  revalidatePath(`/catalogo/insumos/${id}`);
  redirect("/catalogo/insumos");
}

export async function alternarActivoInsumo(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.insumo.findFirstOrThrow({ where: { id, empresaId } });
    const despues = await tx.insumo.update({ where: { id, empresaId }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Insumo", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/catalogo/insumos");
}
