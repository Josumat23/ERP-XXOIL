import { EstadoNoConformidad } from "@/generated/prisma/client";

const SIGUIENTE: Record<EstadoNoConformidad, EstadoNoConformidad[]> = {
  ABIERTA: [EstadoNoConformidad.INVESTIGACION],
  INVESTIGACION: [EstadoNoConformidad.IMPLEMENTACION],
  IMPLEMENTACION: [EstadoNoConformidad.VERIFICACION],
  VERIFICACION: [EstadoNoConformidad.CERRADA, EstadoNoConformidad.IMPLEMENTACION],
  CERRADA: [],
};
export function transicionCapaPermitida(actual: EstadoNoConformidad, siguiente: EstadoNoConformidad) { return SIGUIENTE[actual].includes(siguiente); }
