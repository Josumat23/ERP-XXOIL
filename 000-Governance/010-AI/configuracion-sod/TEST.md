# TEST — Verificación — configuracion-sod

La suite normal `npm test` descubre todos los archivos `tests/*.test.ts` e incluye `sod-conflicts.test.ts`.

Escenarios automatizados:

1. La matriz contiene exactamente Materiales, Finanzas, Ventas y RR.HH.
2. Crear + aprobar y editar + aprobar producen el código esperado en cada dominio.
3. Perfiles solo operadores o solo aprobadores son válidos.
4. Producción y Configuración no reciben reglas no sustentadas.
5. Todos los conflictos se reportan en orden estable.

Validación de entrega: `prisma format --check`, `prisma validate`, lint, TypeScript, suite completa con SQLite temporal fuera del repositorio y build.
