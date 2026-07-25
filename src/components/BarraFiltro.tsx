// Barra de filtros por GET: sin JS de cliente, funciona con Server
// Components. Enter en el campo de texto ya envía el formulario; los
// selects adicionales (children) se aplican al tocar "Filtrar".
export default function BarraFiltro({
  q,
  placeholder = "Buscar...",
  children,
}: {
  q?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const hayFiltros = Boolean(q);
  return (
    <form className="flex flex-wrap items-end gap-3 mb-4 no-imprimir">
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px] max-w-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Buscar</span>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="campo-input"
        />
      </label>
      {children}
      <button type="submit" className="boton-secundario">
        Filtrar
      </button>
      {hayFiltros && (
        <a href="." className="text-sm text-neutral-500 hover:underline pb-2">
          Limpiar
        </a>
      )}
    </form>
  );
}
