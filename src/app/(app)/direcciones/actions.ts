"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar, type ClaveModulo } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { entidadEsDeLaEmpresa } from "@/lib/entidadesDeLaEmpresa";
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

function rutaEntidadDireccion(entidadTipo: TipoEntidadDireccion, entidadId: string): string {
  if (entidadTipo === "Cliente") return `/comercial/clientes/${entidadId}`;
  if (entidadTipo === "Proveedor") return `/catalogo/proveedores/${entidadId}`;
  return `/rrhh/empleados/${entidadId}`;
}

async function puedeEditarDirecciones(usuario: Usuario, entidadTipo: string): Promise<boolean> {
  if (!esTipoEntidadDireccion(entidadTipo)) return false;
  if (usuario.rol === "ADMIN") return true;
  const politica = POLITICA_DIRECCION[entidadTipo];
  return usuario.rol === politica.rol && puedeRealizar(usuario, politica.modulo, "editar");
}
// Para EMPLEADO esto solo comprobaba que el id existiera, sin mirar la
// compañía, teniendo `Empleado` su `empresaId` como todos los demás: sabiendo
// un id, un usuario de una compañía podía agregarle o borrarle direcciones al
// empleado de otra. La comprobación vive ahora en un solo lugar, compartida
// con adjuntos y contactos, que tenían la misma asimetría.
const existeEntidadDireccionAutorizada = entidadEsDeLaEmpresa;

export async function agregarDireccion(
  entidadTipo: string,
  entidadId: string,
  _rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  void _rutaRevalidar;
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
        where: { empresaId, entidadTipo, entidadId },
        data: { esPrincipal: false },
      });
    }
    await tx.direccion.create({
      data: {
        empresaId,
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

  revalidatePath(rutaEntidadDireccion(entidadTipo, entidadId));
  return {};
}

export async function eliminarDireccion(id: string, _rutaRevalidar: string) {
  void _rutaRevalidar;
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  // El id llega del navegador: la dirección se busca YA acotada a la compañía
  // activa. Antes se leía por id a secas y la compañía se comprobaba después,
  // contra la entidad; ahora la fila lleva la suya y se filtra de entrada.
  const empresaId = await obtenerEmpresaActivaId();
  const direccion = await prisma.direccion.findFirst({ where: { id, empresaId } });
  if (
    !direccion ||
    !esTipoEntidadDireccion(direccion.entidadTipo) ||
    !(await puedeEditarDirecciones(usuario, direccion.entidadTipo))
  ) {
    return;
  }
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
  revalidatePath(rutaEntidadDireccion(direccion.entidadTipo, direccion.entidadId));
}
