"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const productoId = String(formData.get("productoId") ?? "");
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const contenidoKg = Number(formData.get("contenidoKg"));
  const contenidoLitrosRaw = String(formData.get("contenidoLitros") ?? "").trim();
  const contenidoLitros = contenidoLitrosRaw ? Number(contenidoLitrosRaw) : null;
  const precio = Number(formData.get("precio"));
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);
  const codigoBarras = String(formData.get("codigoBarras") ?? "").trim() || null;
  const pesoBrutoRaw = String(formData.get("pesoBrutoKg") ?? "").trim();
  const pesoBrutoKg = pesoBrutoRaw ? Number(pesoBrutoRaw) : null;
  const unidadesPorCajaRaw = String(formData.get("unidadesPorCaja") ?? "").trim();
  const unidadesPorCaja = unidadesPorCajaRaw ? Number(unidadesPorCajaRaw) : null;
  const zonaAlmacenId = String(formData.get("zonaAlmacenId") ?? "") || null;

  if (!productoId || !sku || !nombre) {
    return { error: "Producto, SKU y nombre son obligatorios." } as const;
  }
  if (!Number.isFinite(contenidoKg) || contenidoKg <= 0) {
    return { error: "El contenido en kg debe ser un número mayor a 0." } as const;
  }
  if (contenidoLitros !== null && (!Number.isFinite(contenidoLitros) || contenidoLitros <= 0)) {
    return { error: "El contenido en litros debe ser un número mayor a 0 (o déjelo vacío)." } as const;
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return { error: "El precio debe ser un número válido." } as const;
  }
  if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock mínimo debe ser un número válido." } as const;
  }
  if (codigoBarras && !/^\d{8,14}$/.test(codigoBarras)) {
    return { error: "El código de barras debe tener entre 8 y 14 dígitos (EAN/UPC)." } as const;
  }
  if (pesoBrutoKg !== null && (!Number.isFinite(pesoBrutoKg) || pesoBrutoKg < contenidoKg)) {
    return { error: "El peso bruto debe ser mayor o igual al contenido neto." } as const;
  }
  if (unidadesPorCaja !== null && (!Number.isInteger(unidadesPorCaja) || unidadesPorCaja <= 0)) {
    return { error: "Las unidades por caja deben ser un entero mayor a 0." } as const;
  }

  return {
    datos: {
      productoId,
      sku,
      nombre,
      contenidoKg,
      contenidoLitros,
      precio,
      stockMinimo,
      codigoBarras,
      pesoBrutoKg,
      unidadesPorCaja,
      zonaAlmacenId,
      moneda: "PEN",
    },
  } as const;
}

export async function crearPresentacion(
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

  const stockInicial = Number(formData.get("stock") ?? 0);
  if (!Number.isFinite(stockInicial) || stockInicial < 0) {
    return { error: "El stock inicial debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creada = await tx.presentacion.create({ data: resultado.datos });
      if (stockInicial > 0) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: creada.id,
          tipoMovimiento: "ENTRADA",
          origen: "STOCK_INICIAL",
          cantidad: stockInicial,
          referencia: "Alta de presentación",
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe una presentación con el SKU "${resultado.datos.sku}".` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/catalogo/presentaciones");
  redirect("/catalogo/presentaciones");
}

// La edición nunca toca el stock: eso solo ocurre vía kardex (ajustes, producción, ventas).
export async function actualizarPresentacion(
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

  try {
    await prisma.presentacion.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe una presentación con el SKU "${resultado.datos.sku}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/presentaciones");
  revalidatePath(`/catalogo/presentaciones/${id}`);
  redirect("/catalogo/presentaciones");
}

export async function alternarActivoPresentacion(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  await prisma.presentacion.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/presentaciones");
}

// --- Escalones de precio por volumen ----------------------------------------

export async function crearEscalonPrecio(
  presentacionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const cantidadMinima = Number(formData.get("cantidadMinima"));
  const precio = Number(formData.get("precio"));

  if (!Number.isInteger(cantidadMinima) || cantidadMinima <= 1) {
    return { error: "La cantidad mínima debe ser un entero mayor a 1 (para 1 unidad ya está el precio base)." };
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return { error: "El precio debe ser un número válido." };
  }

  try {
    await prisma.escalonPrecio.create({ data: { presentacionId, cantidadMinima, precio } });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un escalón para ${cantidadMinima} unidades.` };
    }
    throw e;
  }

  revalidatePath(`/catalogo/presentaciones/${presentacionId}`);
  revalidatePath("/comercial/pedidos/nuevo");
  return {};
}

export async function eliminarEscalonPrecio(id: string, presentacionId: string) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;
  await prisma.escalonPrecio.delete({ where: { id } });
  revalidatePath(`/catalogo/presentaciones/${presentacionId}`);
  revalidatePath("/comercial/pedidos/nuevo");
}
