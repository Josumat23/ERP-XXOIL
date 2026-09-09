# Aislamiento multiempresa del catálogo de insumos

Las pantallas de lista, alta y edición de insumos operan exclusivamente sobre la empresa activa. Los selectores de proveedor se filtran por esa empresa y las acciones vuelven a validar en el servidor que proveedor y ubicación pertenezcan a ella.

La creación guarda `empresaId` explícitamente. La edición y activación exigen simultáneamente el identificador del insumo y la compañía activa, evitando que un identificador obtenido fuera de la interfaz permita modificar otra compañía.

Este cambio completa una porción del endurecimiento multiempresa. El resto del grafo se aborda por dominio para mantener cada cambio verificable y reversible.
