"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar, type ClaveModulo } from "@/lib/permisos";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import type { $Enums, Usuario } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

type TipoEntidadContacto = "Cliente" | "Proveedor" | "Empleado";

const POLITICA_CONTACTO: Record<
  TipoEntidadContacto,
  { rol: $Enums.RolUsuario; modulo: ClaveModulo }
> = {
  Cliente: { rol: "VENTAS", modulo: "ventas" },
  Proveedor: { rol: "ALMACEN", modulo: "materiales" },
  Empleado: { rol: "GERENCIA", modulo: "rrhh" },
};

function esTipoEntidadContacto(valor: string): valor is TipoEntidadContacto {
  return valor === "Cliente" || valor === "Proveedor" || valor === "Empleado";
}

async function puedeEditarContactos(usuario: Usuario, entidadTipo: string): Promise<boolean> {
  if (!esTipoEntidadContacto(entidadTipo)) return false;
  if (usuario.rol === "ADMIN") return true;
  const politica = POLITICA_CONTACTO[entidadTipo];
  return usuario.rol === politica.rol && puedeRealizar(usuario, politica.modulo, "editar");
}
async function existeEntidadContactoAutorizada(
  entidadTipo: TipoEntidadContacto,
  entidadId: string,
  empresaId: string
): Promise<boolean> {
  if (entidadTipo === "Empleado") {
    return Boolean(
      await prisma.empleado.findUnique({ where: { id: entidadId }, select: { id: true } })
    );
  }
  const entidad = entidadTipo === "Cliente"
    ? await prisma.cliente.findUnique({
        where: { id: entidadId },
        select: { empresaId: true },
      })
    : await prisma.proveedor.findUnique({
        where: { id: entidadId },
        select: { empresaId: true },
      });
  return perteneceAEmpresaActiva(entidad, empresaId);
}

export async function agregarContacto(
  entidadTipo: string,
  entidadId: string,
  rutaRevalidar: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { error: "Sesión expirada. Vuelva a iniciar sesión." };
  if (!(await puedeEditarContactos(usuario, entidadTipo)) || !esTipoEntidadContacto(entidadTipo)) {
    return { error: "No tiene permiso para editar contactos de esta entidad." };
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (!(await existeEntidadContactoAutorizada(entidadTipo, entidadId, empresaId))) {
    return { error: "La entidad no existe en la compañía activa." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const esPrincipal = formData.get("esPrincipal") === "on";

  if (!nombre) return { error: "El nombre es obligatorio." };

  await prisma.$transaction(async (tx) => {
    if (entidadTipo === "Cliente") {
      await tx.cliente.update({ where: { id: entidadId }, data: { id: entidadId } });
    } else if (entidadTipo === "Proveedor") {
      await tx.proveedor.update({ where: { id: entidadId }, data: { id: entidadId } });
    } else {
      await tx.empleado.update({ where: { id: entidadId }, data: { id: entidadId } });
    }
    if (esPrincipal) {
      await tx.contacto.updateMany({
        where: { entidadTipo, entidadId },
        data: { esPrincipal: false },
      });
    }
    await tx.contacto.create({
      data: { entidadTipo, entidadId, nombre, cargo, telefono, email, esPrincipal },
    });
  });

  revalidatePath(rutaRevalidar);
  return {};
}

export async function eliminarContacto(id: string, rutaRevalidar: string) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;
  const contacto = await prisma.contacto.findUnique({ where: { id } });
  if (
    !contacto ||
    !esTipoEntidadContacto(contacto.entidadTipo) ||
    !(await puedeEditarContactos(usuario, contacto.entidadTipo))
  ) {
    return;
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (
    !(await existeEntidadContactoAutorizada(
      contacto.entidadTipo,
      contacto.entidadId,
      empresaId
    ))
  ) {
    return;
  }
  await prisma.contacto.delete({ where: { id: contacto.id } });
  revalidatePath(rutaRevalidar);
}
