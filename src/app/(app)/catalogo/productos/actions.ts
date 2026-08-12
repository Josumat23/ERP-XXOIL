"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";

const SEGMENTOS_VALIDOS: $Enums.SegmentoMercado[] = [
  "AUTOMOTRIZ",
  "INDUSTRIAL",
  "MINERO",
  "AGRICOLA",
  "MARINO",
  "OTRO",
];
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const unidadMedidaBase = String(formData.get("unidadMedidaBase") ?? "kg").trim() || "kg";
  const marca = String(formData.get("marca") ?? "").trim() || null;
  const gradoNlgi = String(formData.get("gradoNlgi") ?? "").trim() || null;
  const viscosidad = String(formData.get("viscosidad") ?? "").trim() || null;
  const notasTecnicas = String(formData.get("notasTecnicas") ?? "").trim() || null;
  const vidaUtilMesesRaw = String(formData.get("vidaUtilMeses") ?? "").trim();
  const vidaUtilMeses = vidaUtilMesesRaw ? Number(vidaUtilMesesRaw) : null;
  const fichaTecnicaUrl = String(formData.get("fichaTecnicaUrl") ?? "").trim() || null;
  const hojaSeguridadUrl = String(formData.get("hojaSeguridadUrl") ?? "").trim() || null;
  const segmentoMercadoRaw = String(formData.get("segmentoMercado") ?? "").trim();
  const segmentoMercado = segmentoMercadoRaw
    ? (segmentoMercadoRaw as $Enums.SegmentoMercado)
    : null;

  if (!codigo || !nombre || !categoriaId) {
    return { error: "Código, nombre y categoría son obligatorios." } as const;
  }
  if (vidaUtilMeses !== null && (!Number.isInteger(vidaUtilMeses) || vidaUtilMeses <= 0)) {
    return { error: "La vida útil debe ser un número entero de meses mayor a 0 (o déjelo vacío si no vence)." } as const;
  }
  if (segmentoMercado !== null && !SEGMENTOS_VALIDOS.includes(segmentoMercado)) {
    return { error: "Seleccione un segmento de mercado válido." } as const;
  }

  return {
    datos: {
      codigo,
      nombre,
      descripcion,
      categoriaId,
      unidadMedidaBase,
      marca,
      gradoNlgi,
      viscosidad,
      vidaUtilMeses,
      segmentoMercado,
      fichaTecnicaUrl,
      hojaSeguridadUrl,
      notasTecnicas,
    },
  } as const;
}

export async function crearProducto(
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

  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.producto.create({ data: resultado.datos });
      await registrarAuditoriaMaestro(tx, { entidad: "Producto", registroId: registro.id, accion: "CREAR", despues: registro, usuario: auth.usuario });
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${resultado.datos.codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/productos");
  redirect("/catalogo/productos");
}

export async function actualizarProducto(
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
    await prisma.$transaction(async (tx) => {
      const antes = await tx.producto.findUniqueOrThrow({ where: { id } });
      const despues = await tx.producto.update({ where: { id }, data: resultado.datos });
      await registrarAuditoriaMaestro(tx, { entidad: "Producto", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${resultado.datos.codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/productos");
  revalidatePath(`/catalogo/productos/${id}`);
  redirect("/catalogo/productos");
}

export async function alternarActivoProducto(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.producto.findUniqueOrThrow({ where: { id } });
    const despues = await tx.producto.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Producto", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/catalogo/productos");
}
