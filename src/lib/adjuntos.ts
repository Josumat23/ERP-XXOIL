import path from "path";

// En Docker, process.cwd() es /app (WORKDIR) — esto resuelve dentro del mismo
// volumen persistente que ya usa la base SQLite (ver docker-compose.yml).
// En desarrollo local/Codespaces, crea ./data/adjuntos relativo al repo.
export const DIRECTORIO_ADJUNTOS = process.env.ADJUNTOS_DIR ?? path.join(process.cwd(), "data", "adjuntos");

export const TIPOS_MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

export function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
