"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar, type ClaveModulo } from "@/lib/permisos";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import { TipoDireccion, type $Enums, type Usuario } from "@/generated/prisma/client";
import { esValorEnum } from "@/lib/enums";

export type EstadoFormulario = { error?: string };

type TipoEntidadDireccion = "Cliente" | "Proveedor" | "Empleado";

const POLITICA_DIRECCION: Record<
  TipoEntidadDireccion,
  { rol: $Enums.RolUsuario; modulo: ClaveModulo }
> = {
  Cliente: { rol: "VENTAS", modulo: "ventas" },
  Proveedor: { rol: "ALMACEN", modulo: "materiales" },
  Empleado: { rol: "GERENCIA", modulo: "rrhh" },
};

function esTipoEntidadDireccion(valor: string): valor is TipoEntidadDireccion {
  return valor === "Cliente" || valor === "Proveedor" || valor === "Empleado";
}

async function puedeEditarDirecciones(usuario: Usuario, entidadTipo: string): Promise<boolean> {
  if (!esTipoEntidadDireccion(entidadTipo)) return false;
  if (usuario.rol === "ADMIN") return true;
  const politica = POLITICA_DIRECCION[entidadTipo];
  return usuario.rol === politica.rol && puedeRealizar(usuario, politica.modulo, "editar");
}
async function existeEntidadDireccionAutorizada(
  entidadTipo: TipoEntidadDireccion,
  entidadId: string,
  empresaId: string
): Promise<boolean> {
  if (entidadTipo === "Cliente") {
    const cliente = await prisma.cliente.findUnique({
      where: { id: entidadId },
      select: { empresaId: true },
    });
    return perteneceAEmpresaActiva(cliente, empresaId);
  }
  if (entidadTipo === "Proveedor") {
    const proveedor = await prisma.proveedor.findUnique({
      where: { id: entidadId },
      select: { empresaId: true },
    });
    return perteneceAEmpresaActiva(proveedor, empresaId);
  }
  return Boolean(
    await prisma.empleado.findUnique({ where: { id: entidadId }, select: { id: true } })
  );
}

export async function agregarDireccion(
  entidadTipo: string,
  entidadId: string,
  rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };
  if (!(await puedeEditarDirecciones(usuario, entidadTipo)) || !esTipoEntidadDireccion(entidadTipo)) {
    return { error: "No tiene permiso para editar direcciones de esta entidad." };
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (!(await existeEntidadDireccionAutorizada(entidadTipo, entidadId, empresaId))) {
    return { error: "La entidad no existe en la compañía activa." };
  }

  const tipo = String(formData.get("tipo") ?? "OTRA");
  if (!esValorEnum(Object.values(TipoDireccion), tipo)) {
    return { error: "Seleccione un tipo de dirección válido." };
  }
  const pais = String(formData.get("pais") ?? "").trim();
  const departamento = String(formData.get("departamento") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim() || null;
  const esPrincipal = formData.get("esPrincipal") === "on";

  if (!pais) return { error: "El país es obligatorio." };
  if (!direccion) return { error: "La dirección es obligatoria." };

  await prisma.$transaction(async (tx) => {
    if (entidadTipo === "Cliente") {
      await tx.cliente.update({ where: { id: entidadId }, data: { id: entidadId } });
    } else if (entidadTipo === "Proveedor") {
      await tx.proveedor.update({ where: { id: entidadId }, data: { id: entidadId } });
    } else {
      await tx.empleado.update({ where: { id: entidadId }, data: { id: entidadId } });
    }
    if (esPrincipal) {
      await tx.direccion.updateMany({
        where: { entidadTipo, entidadId },
        data: { esPrincipal: false },
      });
    }
    await tx.direccion.create({
      data: {
        entidadTipo,
        entidadId,
        tipo,
        pais,
        departamento,
        provincia,
        distrito,
        direccion,
        codigoPostal,
        esPrincipal,
      },
    });
  });

  revalidatePath(rutaRevalidar);
  return {};
}

export async function eliminarDireccion(id: string, rutaRevalidar: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  const direccion = await prisma.direccion.findUnique({ where: { id } });
  if (
    !direccion ||
    !esTipoEntidadDireccion(direccion.entidadTipo) ||
    !(await puedeEditarDirecciones(usuario, direccion.entidadTipo))
  ) {
    return;
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (
    !(await existeEntidadDireccionAutorizada(
      direccion.entidadTipo,
      direccion.entidadId,
      empresaId
    ))
  ) {
    return;
  }
  await prisma.direccion.delete({ where: { id: direccion.id } });
  revalidatePath(rutaRevalidar);
}
