// ---------------------------------------------------------------------------
// El semáforo del panel general.
//
// Cada módulo muestra UNA línea, así que cuando hay varias cosas que decir hay
// que elegir. La regla que ya usaba Finanzas —una operación sin asiento tapa a
// una factura vencida— se generaliza acá: gana la más severa, y entre iguales,
// la primera que se declaró.
//
// Existe porque el patrón se estaba repitiendo a mano con ternarios anidados de
// tres niveles, y cada fuente nueva lo empeoraba. Con esto agregar una señal es
// agregar un elemento a una lista.
// ---------------------------------------------------------------------------

export type EstadoSemaforo = "bien" | "atencion" | "critico";

export type SenalSemaforo = {
  indicador: string;
  estado: EstadoSemaforo;
};

const SEVERIDAD: Record<EstadoSemaforo, number> = { bien: 0, atencion: 1, critico: 2 };

/**
 * La señal que se muestra: la más severa de la lista.
 *
 * El orden importa dentro del mismo nivel — quien arma la lista decide qué
 * mostrar primero cuando dos cosas pesan igual, y esa decisión queda a la vista
 * en el orden y no escondida en un ternario.
 */
export function senalMasSevera(senales: SenalSemaforo[], sinSenales: string): SenalSemaforo {
  if (senales.length === 0) return { indicador: sinSenales, estado: "bien" };
  return senales.reduce((peor, s) =>
    SEVERIDAD[s.estado] > SEVERIDAD[peor.estado] ? s : peor
  );
}

/** Plural sin la muleta de «(s)», que se lee mal en un panel. */
export function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

/**
 * Señales de evidencia que dejó de sostenerse.
 *
 * Las tres nacieron en ciclos distintos y comparten la misma forma: algo que se
 * afirmó con respaldo, y el respaldo caducó sin que nadie tocara la afirmación.
 * Lo que las hacía inútiles era que solo se veían entrando a su propia
 * pantalla.
 */
export function senalHomologaciones(vencidas: number, porVencer: number): SenalSemaforo[] {
  const senales: SenalSemaforo[] = [];
  if (vencidas > 0) {
    senales.push({
      // Una homologación vencida no se imprime más en el certificado y baja la
      // cobertura de las equivalencias. No rompe nada: hay que renovarla.
      indicador: `${plural(vencidas, "homologación vencida", "homologaciones vencidas")}`,
      estado: "atencion",
    });
  }
  if (porVencer > 0) {
    senales.push({
      indicador: `${plural(porVencer, "homologación por vencer", "homologaciones por vencer")}`,
      estado: "atencion",
    });
  }
  return senales;
}

export function senalEquivalencias(degradadas: number): SenalSemaforo[] {
  if (degradadas === 0) return [];
  return [
    {
      // Se sigue ofreciendo un reemplazo que hoy cubre menos de lo que cubría
      // cuando alguien lo declaró. Es una afirmación comercial desactualizada.
      indicador: `${plural(degradadas, "equivalencia que cubre menos", "equivalencias que cubren menos")} que al declararla`,
      estado: "atencion",
    },
  ];
}

export function senalCalibraciones(criticos: number, porVencer: number): SenalSemaforo[] {
  const senales: SenalSemaforo[] = [];
  if (criticos > 0) {
    senales.push({
      // Un instrumento vencido o fuera de tolerancia no puede liberar un lote:
      // lo que mida no se sostiene. Eso es crítico, no aviso.
      indicador: `${plural(criticos, "instrumento", "instrumentos")} sin calibración vigente`,
      estado: "critico",
    });
  }
  if (porVencer > 0) {
    senales.push({
      indicador: `${plural(porVencer, "instrumento por calibrar", "instrumentos por calibrar")} este mes`,
      estado: "atencion",
    });
  }
  return senales;
}
