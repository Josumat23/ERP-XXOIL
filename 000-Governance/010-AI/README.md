# Gobernanza de documentación — ERP-XXOIL

> # ⛔ CONVENCIÓN RETIRADA — 2026-09-14
>
> **Decisión del usuario.** Esta convención ya no rige. Los módulos nuevos o modificados
> **no** llevan la carpeta de siete archivos. Lo que sigue más abajo se conserva como
> registro de lo que fue y de lo que documentan los diez módulos que alcanzó a cubrir.

## Por qué se retira

**Ya había dejado de aplicarse.** Se adoptó el 2026-08-04 y se usó por última vez el
**2026-09-08** (`mrp-neteo-demanda`). Cubrió diez módulos. Desde entonces se construyeron
**9 módulos de pantalla y 23 de librería** sin ninguna carpeta de gobernanza. Una convención
que no se sigue no gobierna nada: dejarla escrita solo aparenta un estándar que no existe, y
quien lea el repositorio creerá que hay siete documentos por módulo donde no los hay.

**Lo que la reemplazó funciona mejor en la práctica.** Desde el 2026-09-09 cada ciclo entrega
un `docs/<tema>.md` —**72** hasta hoy— que explica **la decisión y su costo**: qué se
construyó, qué se descartó, qué quedó sin resolver y por qué. El formato de siete archivos
repartía una sola decisión entre siete encabezados que había que rellenar, y el resultado se
leía como un formulario, no como una explicación.

**Buena parte de los siete archivos ya la sostiene algo que no puede mentir:**

| Archivo | Quién lo sostiene ahora |
| --- | --- |
| `TEST.md` (plan de verificación) | La suite: **403 pruebas en 38 archivos**, incluidas guardias estructurales que fallan si se reintroduce un defecto de clase conocida |
| `SQL.md` (cambios de esquema) | Las migraciones versionadas, más `prisma migrate diff` en CI |
| `API.md` (server actions) | Las firmas tipadas y las pruebas que ejercen cada acción |
| `RF.md` / `RN.md` (requisitos y reglas) | Las pruebas de reglas puras y el `docs/<tema>.md` del ciclo |

La documentación que repite lo que el código ya afirma no queda sincronizada: cuando divergen,
gana el código y el documento pasa a mentir en silencio. Las guardias de la suite son la
versión que no puede divergir, porque fallan.

**El propio README advertía contra esto.** Pedía llenar los siete archivos *"antes o durante la
construcción, no después como formalidad vacía"*. Que hayan dejado de llenarse es la señal de
que se habían vuelto justamente eso.

## Qué NO se retira

- **La verificación en navegador.** Estaba escrita en el paso 3 de esta misma convención y
  **sigue siendo obligatoria**. Es una práctica distinta del formato de archivos, y hoy tiene
  una deuda real: las funciones construidas entre el 2026-09-12 y el 2026-09-14 se entregaron
  con pruebas, lint, build y CI en verde **sin que nadie mirara una pantalla**. Es exactamente
  el patrón que el 2026-09-11 destapó una fuga entre compañías que ninguna prueba veía
  (`docs/verificacion-en-navegador.md`).
- **Los diez módulos ya documentados.** No se borran. Son el registro de lo que se decidió
  entonces, y el blueprint los cita como evidencia.
- **`docs/gobernanza/`**, que es otra cosa: los diagnósticos puntuales como el cruce con los 17
  catálogos SAP. Sigue vigente.

## Qué se hace en su lugar

Por cada ciclo: implementación, migración si aplica, pruebas automatizadas, **un
`docs/<tema>.md`** que explique la decisión, anotación en el roadmap, y la cadena completa de
verificación antes del PR.

---

*Lo que sigue es el texto original de la convención, tal como rigió entre el 2026-08-04 y el
2026-09-08.*

---


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
