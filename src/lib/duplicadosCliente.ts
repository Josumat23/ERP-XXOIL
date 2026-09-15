// Detección de clientes duplicados.
//
// Funciones puras, sin Prisma.
//
// El índice único de RUC ya impide el duplicado **exacto**. El que se cuela es
// el otro: el mismo contribuyente cargado como «20123456789» y como
// «20-123456789», o «Ferretería San Martín S.R.L.» y «FERRETERIA SAN MARTIN
// SRL».
//
// Importa porque el cliente es la llave de casi todo: un duplicado parte en
// dos el historial de crédito, el saldo de cascos y la cobranza. Cada mitad
// parece estar al día.

/**
 * El documento sin nada que lo disfrace: solo letras y dígitos, en mayúscula.
 *
 * Es lo que se guarda en `documentoNormalizado` y lo que lleva el índice
 * único, de modo que **la base rechaza el duplicado con puntos o guiones**;
 * no depende de que alguien se acuerde de comparar.
 */
export function normalizarDocumento(documento: string | null): string | null {
  if (!documento) return null;
  const limpio = documento.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return limpio.length > 0 ? limpio : null;
}

/** Formas jurídicas que no distinguen a una empresa de otra. */
const FORMAS_JURIDICAS = [
  "SOCIEDAD ANONIMA CERRADA",
  "SOCIEDAD ANONIMA",
  "SOCIEDAD COMERCIAL DE RESPONSABILIDAD LIMITADA",
  "EMPRESA INDIVIDUAL DE RESPONSABILIDAD LIMITADA",
  "SAC",
  "SRL",
  "SCRL",
  "EIRL",
  "SA",
];

/**
 * Clave comparable de una razón social.
 *
 * Quita tildes, puntuación, la forma jurídica y los espacios de más. «Ferretería
 * San Martín S.R.L.» y «FERRETERIA SAN MARTIN SRL» dan la misma clave, que es
 * justamente el duplicado que hoy entra.
 */
export function claveNombre(razonSocial: string): string {
  let s = razonSocial
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas de tilde
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // La forma jurídica se quita solo al final: «SA» en medio de un nombre puede
  // ser parte del nombre, y borrarlo ahí convertiría dos empresas distintas en
  // la misma.
  //
  // La comparación ignora los espacios porque «S.R.L.» ya perdió sus puntos y
  // llegó acá como «S R L». Compararlo tal cual dejaría fuera justamente la
  // forma de escribirlo que produce el duplicado.
  const sinEspacios = (x: string) => x.replace(/\s+/g, "");
  for (const forma of FORMAS_JURIDICAS) {
    const objetivo = sinEspacios(forma);
    let corte = s.length;
    while (corte > 0 && sinEspacios(s.slice(corte)).length < objetivo.length) corte--;
    if (sinEspacios(s.slice(corte)) !== objetivo) continue;
    // Solo si el corte cae en un límite de palabra: si no, se estaría
    // partiendo un nombre por la mitad.
    if (corte > 0 && s[corte - 1] !== " ") continue;
    const recortado = s.slice(0, corte).trim();
    // Una empresa cuyo nombre entero es la forma jurídica conserva el suyo:
    // una clave vacía se parecería a cualquier otra clave vacía.
    if (recortado.length > 0) s = recortado;
    break;
  }
  return s;
}

/** Distancia de edición, con una sola fila de trabajo. */
function distanciaEdicion(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      siguiente[j] = Math.min(siguiente[j - 1] + 1, fila[j] + 1, fila[j - 1] + costo);
    }
    fila = siguiente;
  }
  return fila[b.length];
}

/** 1 = idénticos, 0 = nada en común. */
export function similitud(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const largo = Math.max(a.length, b.length);
  if (largo === 0) return 1;
  return 1 - distanciaEdicion(a, b) / largo;
}

/**
 * Umbral de parecido para avisar.
 *
 * 0.85 deja pasar una letra cambiada en un nombre corto y dos o tres en uno
 * largo, que es el error de tipeo real. Bajarlo llenaría el aviso de falsos
 * positivos —«Grifo Norte» y «Grifo Sur» se parecen mucho y son dos clientes—
 * y un aviso que salta siempre se ignora siempre.
 */
export const UMBRAL_SIMILITUD = 0.85;

export type ClienteComparable = {
  id: string;
  codigo: string;
  razonSocial: string;
  documentoNormalizado: string | null;
  direccion: string | null;
};

export type MotivoDuplicado = "MISMO_DOCUMENTO" | "NOMBRE_Y_DIRECCION" | "NOMBRE_PARECIDO";

export type PosibleDuplicado = {
  cliente: ClienteComparable;
  motivo: MotivoDuplicado;
  similitud: number;
};

const PESO: Record<MotivoDuplicado, number> = {
  MISMO_DOCUMENTO: 0,
  NOMBRE_Y_DIRECCION: 1,
  NOMBRE_PARECIDO: 2,
};

/**
 * Candidatos a ser el mismo cliente.
 *
 * La dirección **no basta por sí sola**: en una galería o un mercado conviven
 * decenas de clientes en la misma puerta, y avisar por eso sería ruido. Solo
 * refuerza un nombre que ya se parece, y entonces sube la sospecha de
 * «parecido» a «nombre y dirección».
 */
export function buscarPosiblesDuplicados(
  candidato: { razonSocial: string; documentoNormalizado: string | null; direccion: string | null },
  existentes: readonly ClienteComparable[]
): PosibleDuplicado[] {
  const claveCandidato = claveNombre(candidato.razonSocial);
  const direccionCandidato = candidato.direccion ? claveNombre(candidato.direccion) : null;

  const hallazgos: PosibleDuplicado[] = [];
  for (const existente of existentes) {
    if (
      candidato.documentoNormalizado &&
      existente.documentoNormalizado === candidato.documentoNormalizado
    ) {
      hallazgos.push({ cliente: existente, motivo: "MISMO_DOCUMENTO", similitud: 1 });
      continue;
    }

    const parecido = similitud(claveCandidato, claveNombre(existente.razonSocial));
    if (parecido < UMBRAL_SIMILITUD) continue;

    const mismaDireccion =
      direccionCandidato !== null &&
      existente.direccion !== null &&
      similitud(direccionCandidato, claveNombre(existente.direccion)) >= UMBRAL_SIMILITUD;

    hallazgos.push({
      cliente: existente,
      motivo: mismaDireccion ? "NOMBRE_Y_DIRECCION" : "NOMBRE_PARECIDO",
      similitud: parecido,
    });
  }

  return hallazgos.sort(
    (a, b) => PESO[a.motivo] - PESO[b.motivo] || b.similitud - a.similitud
  );
}

export const ETIQUETA_MOTIVO_DUPLICADO: Record<MotivoDuplicado, string> = {
  MISMO_DOCUMENTO: "mismo documento",
  NOMBRE_Y_DIRECCION: "nombre y dirección parecidos",
  NOMBRE_PARECIDO: "nombre parecido",
};

export function mensajePosiblesDuplicados(hallazgos: readonly PosibleDuplicado[]): string {
  const lista = hallazgos
    .slice(0, 5)
    .map(
      (h) =>
        `${h.cliente.codigo} — ${h.cliente.razonSocial} (${ETIQUETA_MOTIVO_DUPLICADO[h.motivo]})`
    )
    .join("; ");
  return `Ya existe un cliente que podría ser el mismo: ${lista}. Un duplicado parte en dos el historial de crédito, el saldo de cascos y la cobranza. Si de verdad es otro cliente, márquelo para crearlo igual.`;
}
