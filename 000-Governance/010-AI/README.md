# Gobernanza de documentación — ERP-XXOIL

**Decisión tomada:** 2026-08-04, por el usuario, en respuesta a la pregunta abierta dejada en
`docs/gobernanza/03-plan-priorizado-y-hoja-de-ruta.md` (sección 3.4).

## Qué se decidió

Adoptar la convención `000-Governance/010-AI/<módulo>/RF-RN-CU-API-SQL-UI-TEST` **hacia adelante**,
para todo módulo **nuevo o modificado** a partir de esta fecha. **No es retroactiva**: los ~112
módulos ya construidos (ver inventario en `docs/gobernanza/00-inventario-erp-actual.md`) no se
documentan con esta estructura salvo que se toquen de nuevo.

## Cómo se usa

1. Al empezar a construir o modificar un módulo, copiar `_plantilla/` a `010-AI/<módulo>/`
   (nombre de carpeta = el mismo nombre de ruta que usa el código, ej. `produccion-formulas`,
   `finanzas-ordenes-internas`).
2. Llenar los 7 archivos **antes o durante** la construcción, no después como formalidad vacía:
   - **RF.md** — Requisitos funcionales: qué debe hacer el módulo, numerado (`RF-<MOD>-001`).
   - **RN.md** — Reglas de negocio: restricciones y lógica de dominio, numerado (`RN-<MOD>-001`).
   - **CU.md** — Casos de uso: actor, precondición, flujo principal, flujos alternativos, postcondición.
   - **API.md** — Server actions expuestas (esta app usa Next.js Server Actions, no REST): firma,
     parámetros, validaciones, efectos secundarios.
   - **SQL.md** — Cambios de schema Prisma: modelos/campos nuevos, migración, motivo.
   - **UI.md** — Pantallas y su comportamiento: qué se ve, qué interacciones dispara, qué estados.
   - **TEST.md** — Plan de verificación: qué se probó en navegador, con qué datos, qué resultado.
3. El flujo de entrega no cambia: construir → verificar en navegador (real, no solo `tsc`) →
   anotar `docs/gobernanza/03-plan-priorizado-y-hoja-de-ruta.md` si el módulo viene de ese roadmap
   → confirmar con el usuario antes de `git push`. Esta documentación es **adicional**, no
   reemplaza la verificación en navegador ni el gate de confirmación antes de subir.

## Por qué esta forma y no otra

El prompt original de este proyecto (el mismo que generó el diagnóstico de 17 catálogos SAP en
`docs/gobernanza/02-cruce-rf/`) asumía esta estructura pero nunca especificó el detalle exacto de
disposición de carpetas. Se interpretó `RF/RN/CU/API/SQL/UI/TEST` como 7 archivos dentro de la
carpeta de cada módulo (no 7 carpetas con un archivo por módulo adentro) porque es lo que escala
mejor cuando los módulos se tocan de forma incremental a lo largo de muchas sesiones — cada
módulo es autocontenible, no hay que buscar en 7 lugares distintos para entender uno solo.
