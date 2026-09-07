export type PermisoSoD = {
  modulo: string;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeAprobar: boolean;
};

export type ReglaConflictoSoD = {
  codigo: string;
  modulo: string;
  descripcion: string;
};

export type ConflictoSoD = ReglaConflictoSoD;

export const REGLAS_CONFLICTO_SOD: readonly ReglaConflictoSoD[] = [
  {
    codigo: "SOD-MATERIALES-OPERAR-APROBAR",
    modulo: "materiales",
    descripcion: "Materiales no puede combinar crear o editar con aprobar en el mismo grupo.",
  },
  {
    codigo: "SOD-FINANZAS-OPERAR-APROBAR",
    modulo: "finanzas",
    descripcion: "Finanzas no puede combinar crear o editar con aprobar en el mismo grupo.",
  },
  {
    codigo: "SOD-VENTAS-OPERAR-APROBAR",
    modulo: "ventas",
    descripcion: "Ventas no puede combinar crear o editar con aprobar en el mismo grupo.",
  },
  {
    codigo: "SOD-RRHH-OPERAR-APROBAR",
    modulo: "rrhh",
    descripcion: "Recursos Humanos no puede combinar crear o editar con aprobar en el mismo grupo.",
  },
] as const;

export function evaluarConflictosSoD(permisos: readonly PermisoSoD[]): ConflictoSoD[] {
  const permisosPorModulo = new Map(permisos.map((permiso) => [permiso.modulo, permiso]));

  return REGLAS_CONFLICTO_SOD.filter((regla) => {
    const permiso = permisosPorModulo.get(regla.modulo);
    return permiso?.puedeAprobar === true &&
      (permiso.puedeCrear === true || permiso.puedeEditar === true);
  });
}
