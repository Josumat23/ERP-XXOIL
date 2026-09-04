export type RegistroIndicadorAsistencia = { empleadoId: string; estado: "BORRADOR" | "APROBADO"; ausenciaJustificada: boolean; minutosTardanza: number; minutosSobretiempo: number };

export function resumirAsistencia(registros: RegistroIndicadorAsistencia[]) {
  const resumen = new Map<string, { diasAsistidos: number; ausenciasJustificadas: number; minutosTardanza: number; minutosSobretiempo: number; pendientes: number }>();
  for (const registro of registros) {
    const fila = resumen.get(registro.empleadoId) ?? { diasAsistidos: 0, ausenciasJustificadas: 0, minutosTardanza: 0, minutosSobretiempo: 0, pendientes: 0 };
    if (registro.estado === "BORRADOR") fila.pendientes++;
    else if (registro.ausenciaJustificada) fila.ausenciasJustificadas++;
    else {
      fila.diasAsistidos++;
      fila.minutosTardanza += registro.minutosTardanza;
      fila.minutosSobretiempo += registro.minutosSobretiempo;
    }
    resumen.set(registro.empleadoId, fila);
  }
  return resumen;
}
