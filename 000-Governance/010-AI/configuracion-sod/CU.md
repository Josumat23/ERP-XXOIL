# CU — Casos de uso — configuracion-sod

## CU-SOD-001 — Asignar permiso sin conflicto

1. Un ADMIN cambia una casilla de un grupo personalizado.
2. La interfaz refleja el valor de forma optimista.
3. El servidor autentica, relee el grupo completo y evalúa la matriz dentro de la transacción.
4. Si no hay conflicto, guarda y registra auditoría.

## CU-SOD-002 — Rechazar combinación incompatible

1. Un ADMIN intenta combinar crear o editar con aprobar en un dominio crítico.
2. El servidor devuelve el código SoD y no persiste ni audita el cambio.
3. La casilla vuelve a su valor anterior y se anuncia un error accesible.
