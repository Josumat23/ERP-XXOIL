import Link from "next/link";

export type RegistroArbol = {
  id: string;
  href: string;
  primario: string;
  secundario?: string;
};

// Reproduce el patrón de Epicor Kinetic para programas de mantenimiento
// (Warehouse Maintenance, Fiscal Calendar Maintenance, GL Control Type...):
// un árbol a la izquierda con los registros existentes y el contenido
// (grilla o ficha de detalle) a la derecha.
export default function PanelMaestroDetalle({
  registros,
  seleccionadoId,
  nuevoHref,
  nuevoTexto = "Nuevo",
  children,
}: {
  registros: RegistroArbol[];
  seleccionadoId?: string;
  nuevoHref?: string;
  nuevoTexto?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-0 rounded-xl overflow-hidden border"
      style={{ borderColor: "var(--epicor-borde)", boxShadow: "var(--sombra-suave)" }}
    >
      <aside
        className="w-60 shrink-0 flex flex-col text-[13px] border-r no-imprimir"
        style={{ borderColor: "var(--epicor-borde)", background: "var(--epicor-panel-2)" }}
      >
        {nuevoHref && (
          <Link
            href={nuevoHref}
            className="px-3 py-2.5 border-b font-semibold hover:bg-[var(--epicor-hover)] transition-colors"
            style={{ borderColor: "var(--epicor-borde)", color: "var(--epicor-azul)" }}
          >
            + {nuevoTexto}
          </Link>
        )}
        <div className="overflow-y-auto flex-1 max-h-[70vh] p-1.5">
          {registros.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className={`flex flex-col px-2.5 py-1.5 rounded-lg transition-colors ${
                r.id === seleccionadoId
                  ? "bg-[var(--epicor-seleccion)] font-semibold"
                  : "hover:bg-[var(--epicor-hover)]"
              }`}
              style={{ color: "var(--epicor-texto)" }}
            >
              <span className="truncate">{r.primario}</span>
              {r.secundario && (
                <span className="truncate text-[11px]" style={{ color: "var(--epicor-texto-tenue)" }}>
                  {r.secundario}
                </span>
              )}
            </Link>
          ))}
          {registros.length === 0 && (
            <p className="px-2.5 py-3 text-[12px]" style={{ color: "var(--epicor-texto-tenue)" }}>
              Sin registros.
            </p>
          )}
        </div>
      </aside>
      <div className="flex-1 min-w-0 p-5" style={{ background: "var(--epicor-panel)" }}>
        {children}
      </div>
    </div>
  );
}
