"use client";

// Imprime la página actual; el navegador permite guardar como PDF.
// Los estilos @media print ocultan la navegación (.no-imprimir).
export default function BotonImprimir({ etiqueta = "Imprimir / PDF" }: { etiqueta?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="boton-secundario no-imprimir">
      🖨 {etiqueta}
    </button>
  );
}
