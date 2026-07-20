import { obtenerConfiguracionEmpresa } from "@/lib/empresa";

// Membrete con los datos fiscales de la empresa para documentos impresos.
// `soloImprimir` lo oculta en pantalla y lo muestra únicamente al imprimir.
export default async function MembreteEmpresa({
  tituloDocumento,
  numero,
  soloImprimir = false,
}: {
  tituloDocumento?: string;
  numero?: string;
  soloImprimir?: boolean;
}) {
  const config = await obtenerConfiguracionEmpresa();

  return (
    <div
      className={`${soloImprimir ? "solo-imprimir" : ""} border-b border-black/10 dark:border-white/10 pb-4 mb-4`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {config.razonSocial}
          </p>
          {config.nombreComercial && (
            <p className="text-sm text-neutral-500">{config.nombreComercial}</p>
          )}
          <p className="text-sm text-neutral-500">
            {config.ruc ? `RUC ${config.ruc}` : ""}
            {config.ruc && (config.direccion || config.ciudad) ? " · " : ""}
            {[config.direccion, config.ciudad].filter(Boolean).join(", ")}
          </p>
          <p className="text-sm text-neutral-500">
            {[config.telefono, config.email, config.sitioWeb].filter(Boolean).join(" · ")}
          </p>
        </div>
        {tituloDocumento && (
          <div className="text-right shrink-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              {tituloDocumento}
            </p>
            {numero && <p className="font-mono text-lg">{numero}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
