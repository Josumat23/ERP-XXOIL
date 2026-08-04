# API — Server actions — &lt;módulo&gt;

Esta app usa Next.js Server Actions (`"use server"`), no un API REST/HTTP separado. Documentar
cada action exportada relevante de `actions.ts`.

## &lt;nombreAction&gt;

- **Archivo:** `src/app/(app)/&lt;ruta&gt;/actions.ts`
- **Firma:** `(prevState, formData) => Promise<EstadoFormulario>` &lt;o el patrón que aplique&gt;
- **Parámetros de entrada (FormData):** &lt;campo: tipo, obligatorio/opcional&gt;
- **Validaciones:** &lt;qué rechaza y con qué mensaje&gt;
- **Efectos secundarios:** &lt;qué modelos escribe, qué asiento contable postea si aplica, qué revalida&gt;
- **Rol/permiso requerido:** &lt;requerirRol([...]) + puedeRealizar(modulo, accion)&gt;
