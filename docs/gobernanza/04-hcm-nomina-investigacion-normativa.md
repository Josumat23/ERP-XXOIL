# HCM — Nómina básica peruana: investigación normativa y propuesta de diseño

**Estado: investigación completada, diseño propuesto, código NO iniciado.** Este documento existe para que el usuario confirme el alcance antes de programar, siguiendo el mismo criterio que se usó con SUNAT/PLE: no se debe inventar una fórmula de cálculo de planilla sin verificar la norma vigente.

---

## 1. Por qué esto es distinto a los demás ítems de la hoja de ruta

Todos los gaps anteriores (MM, TM, EHS, QM, CO) eran reglas de negocio internas de XXOil: se podían diseñar, construir y verificar en una sola sesión porque el criterio de "correcto" lo define la empresa. La nómina es diferente: el criterio de "correcto" lo define la ley peruana (D.S., leyes de EsSalud/ONP/AFP/CTS/gratificaciones), y un error de cálculo tiene consecuencia legal y económica real para XXOil y sus trabajadores. Por eso este ítem se trató aparte.

## 2. Parámetros vigentes verificados (agosto 2026)

Todos los montos/tasas están sujetos a cambio por norma — **ninguno debe quedar hardcodeado en el código**; todos deben ser datos maestros editables (ver sección 4), igual que ya se hace con `tasaIgv` en `ConfiguracionEmpresa`.

| Parámetro | Valor verificado (ago. 2026) | Nota |
|---|---|---|
| RMV (Remuneración Mínima Vital) | S/ 1,130 | El Gobierno anunció el 28/07/2026 un aumento a S/ 1,300, pero **aún no está publicado en El Peruano** — no se debe asumir la fecha de entrada en vigencia. |
| UIT (Unidad Impositiva Tributaria) | S/ 5,500 | Vigente para el ejercicio 2026. |
| Asignación familiar | S/ 113/mes (10% de la RMV) | Solo si el trabajador tiene ≥1 hijo menor de edad (o hasta 24 años si estudia). |
| EsSalud (aporte del empleador) | 9% de la remuneración | No se descuenta al trabajador — es un gasto de planilla del empleador. |
| ONP (Sistema Nacional de Pensiones) | 13% de la remuneración | Descuento al trabajador, si está afiliado a ONP en vez de AFP. |
| AFP — aporte obligatorio | 10% de la remuneración | Va al fondo del propio trabajador. |
| AFP — prima de seguro | ~1.37% (tope remunerativo ~S/ 12,599) | Varía trimestralmente según SBS. |
| AFP — comisión (varía por AFP elegida) | Flujo: Integra 1.55%, Prima 1.60%, Habitat 1.47%, Profuturo 1.69% | El trabajador elige su AFP individualmente; **no hay una tasa única** — debe ser un dato maestro por AFP, no una constante. |
| Impuesto a la renta 5ta categoría | Exonerado hasta 7 UIT/año (S/ 38,500). Tramos: 8% hasta 5 UIT, 14% de 5-20 UIT, 17% de 20-35 UIT, 20% de 35-45 UIT, 30% más de 45 UIT | Estructura estable desde la reforma de 2015; el valor que cambia es la UIT. |
| Gratificación (julio y diciembre) | (Remuneración computable × meses trabajados en el semestre) ÷ 6 | Remuneración computable = básico + asignación familiar + conceptos remunerativos habituales. |
| Bonificación extraordinaria (Ley 30334) | 9% de la gratificación (si está en EsSalud) o 6.75% (si tiene EPS) | La paga el empleador junto con la gratificación, en sustitución del aporte a EsSalud sobre ese monto (la gratificación en sí está inafecta a EsSalud/ONP/AFP). |
| CTS (mayo y noviembre) | (Sueldo + 1/6 de la última gratificación) ÷ 12 × meses trabajados en el semestre | Se deposita en una cuenta CTS del trabajador en una entidad financiera de su elección — **no se paga en planilla como efectivo**. |
| Vacaciones | 30 días/año, proporcional | Ya existe en `SolicitudVacaciones` (item #54, construido en sesión previa). |

Fuentes consultadas: modelo.pe, hacecuentas.com, sueldojusto.pe, tramitesperu.com, finiquitojusto.com, infobae.com (búsquedas de agosto 2026), afpcalculadora.com.

## 3. Alcance propuesto (Fase 1 de HCM) — qué se construye y qué se deja fuera

**Se construye:**
1. Cálculo mensual de planilla: bruto (básico + asignación familiar) → descuentos (ONP o AFP según afiliación del trabajador) → EsSalud como gasto patronal (no descuento) → retención de 5ta categoría (proyección anual simplificada) → neto a pagar.
2. Gratificación de julio y diciembre + bonificación extraordinaria.
3. CTS calculada (mayo/noviembre) — el depósito bancario real queda fuera (ver abajo).
4. Boleta de pago (documento imprimible, como ya existe con facturas/guías).
5. Archivo de pago bancario (CSV/txt) para las transferencias de sueldos — **formato exacto por banco (BCP, BBVA, Interbank, Scotiabank) es una pregunta abierta**, ver sección 5.
6. Interfaz contable: asiento automático de planilla (gasto de personal por centro de costo / ONP-AFP-EsSalud por pagar / CTS por pagar / neto por pagar), reutilizando `postearAsiento()`.
7. Liquidación de desvinculación (finiquito): CTS truncada + gratificación truncada + vacaciones truncadas + vacaciones no gozadas.
8. Datos maestros editables: RMV, UIT, tasa EsSalud, tasa ONP, tabla de AFP (comisión + prima de seguro por AFP), tramos de 5ta categoría — todos con fecha de vigencia, para que un cambio de norma no rompa cálculos de períodos ya cerrados.
9. Campos nuevos en `Empleado`: sistema de pensión (ONP/AFP + cuál AFP), si tiene asignación familiar.

**Se deja explícitamente fuera de esta primera fase (no bloquea reemplazar el Excel):**
- Depósito bancario real de CTS a la entidad elegida por el trabajador (queda como registro contable + reporte, no una integración bancaria).
- Subsidios por incapacidad temporal (descanso médico con reembolso EsSalud) — casuística compleja, baja frecuencia.
- Seguro Vida Ley y SCTR (seguro complementario de trabajo de riesgo) — aplican solo a ciertos puestos; se puede agregar después sin rehacer el motor base.
- Participación en las utilidades — solo aplica a empresas >20 trabajadores con renta de 3ra categoría por encima de cierto régimen; XXOil debe confirmar si aplica antes de construirlo.
- Horas extras con recargo legal (25%/35%) — si XXOil no las usa hoy, se agrega cuando haga falta.
- PDT/PLAME (declaración electrónica a SUNAT) — igual que con PLE, se puede dejar como exportación de datos en el formato que PLAME requiere, en una iteración posterior.

## 4. Modelo de datos propuesto (borrador, sujeto a la confirmación del usuario)

```
ParametroPlanilla        // RMV, UIT, tasaEsSalud, tasaOnp, vigenteDesde
TasaAfp                  // afp (enum), tipoComision (FLUJO/MIXTA), tasaComision, primaSeguro, vigenteDesde
Empleado                 // + sistemaPension (ONP/AFP), afp (opcional), tieneAsignacionFamiliar
PlanillaPeriodo          // anio, mes, tipo (MENSUAL/GRATIFICACION_JULIO/GRATIFICACION_DICIEMBRE/CTS_MAYO/CTS_NOVIEMBRE), estado (ABIERTO/CERRADO)
PlanillaDetalle          // por empleado y período: bruto, descuentos (detalle), essalud, neto, asiento generado
```

## 5. Preguntas abiertas para el usuario

1. **RMV S/1,130 vs S/1,300**: ¿usamos S/1,130 (vigente hoy, verificado) o dejamos el campo parametrizable y en blanco hasta que el aumento se publique oficialmente? (Recomendado: parametrizable, con S/1,130 como valor inicial — así no hay que tocar código cuando cambie.)
2. **Formato del archivo de pago bancario — resuelto parcialmente (2026-08-04):** XXOil confirmó que trabaja con BBVA. No se contaba con la plantilla exacta de carga masiva de BBVA Net Cash (banca empresas) — fabricar ese formato sin la especificación real del banco podía causar rechazo del archivo o, peor, un pago a la cuenta equivocada. Se construyó en su lugar un exportador **genérico** (`/api/planilla/[id]/archivo-pago`, botón "Descargar archivo de pago (CSV)" en `/rrhh/planilla/[id]`, disponible para MENSUAL y GRATIFICACION — no para CTS, que se deposita en la cuenta CTS del trabajador, no en su cuenta de haberes) con las columnas mínimas que cualquier banca empresas pide (documento, nombre, banco, cuenta, CCI, monto). **Pendiente:** cuando XXOil consiga la plantilla oficial de su ejecutivo de banca empresas BBVA, adaptar el exportador al formato exacto de carga automática.
3. **Participación en utilidades**: ¿XXOil tiene más de 20 trabajadores y está en el régimen general de 3ra categoría? Si sí, aplica un gap adicional no listado arriba.
4. **Trabajadores actuales**: ¿todos están en régimen general (planilla), o hay alguno bajo "Locación de servicios" (ya existe como `TipoContrato.LOCACION_SERVICIOS`) que se paga distinto (con retención de 4ta categoría, no 5ta)? Si hay ambos, la Fase 1 debe cubrir los dos casos.

## 6. Próximo paso

Con la confirmación del usuario sobre las preguntas de la sección 5 (o su autorización para asumir los valores recomendados), se procede a: migración de schema, motor de cálculo (`src/lib/planilla.ts`), UI de período de planilla + boleta de pago, y verificación end-to-end con un empleado de prueba — siguiendo el mismo patrón de construir → verificar en navegador → confirmar → subir que se usó en el resto de esta sesión.
