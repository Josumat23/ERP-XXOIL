// Qué archivos de prueba corre una invocación del runner.
//
// Vive aparte y es una función pura para poder probarla: `run-tests.mjs` crea
// una base al importarse, así que no se puede importar desde una prueba, y una
// guardia que lea su código fuente comprobaría el texto en vez del
// comportamiento.

/**
 * Los archivos que corresponden a estos filtros.
 *
 * Sin filtros, todos. Con filtros, los que contengan alguno en su nombre.
 *
 * Devuelve también `parcial`, y eso no es un detalle: una corrida filtrada en
 * verde **no** dice que el sistema esté bien, y quien la lea tiene que poder
 * distinguirla de una completa sin contar archivos.
 */
export function seleccionarPruebas(todos, filtros) {
  const activos = filtros.filter((a) => a !== "" && !a.startsWith("-"));
  if (activos.length === 0) return { archivos: [...todos], parcial: false, filtros: [] };
  const archivos = todos.filter((n) => activos.some((f) => n.includes(f)));
  return { archivos, parcial: true, filtros: activos };
}

/**
 * El error de un filtro que no encontró nada, o `null`.
 *
 * Correr cero pruebas y terminar en verde es exactamente la forma de creer que
 * algo está probado cuando no lo está, así que es un error y no un aviso.
 */
export function errorDeFiltroVacio(seleccion, totalArchivos) {
  if (!seleccion.parcial || seleccion.archivos.length > 0) return null;
  return (
    `Ningún archivo de pruebas coincide con ${seleccion.filtros.map((f) => `«${f}»`).join(", ")}. ` +
    `Hay ${totalArchivos} archivos en tests/; el filtro compara contra el nombre del archivo. ` +
    "No se corrió nada: una corrida vacía en verde es peor que un error."
  );
}

/** El aviso que acompaña a toda corrida filtrada, al empezar y al terminar. */
export function avisoParcial(seleccion, totalArchivos) {
  return (
    `PARCIAL: ${seleccion.archivos.length} de ${totalArchivos} archivos ` +
    `(filtro: ${seleccion.filtros.join(", ")}). Esto NO reemplaza a \`npm test\`.`
  );
}
