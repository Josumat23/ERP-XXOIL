# Qué midió el re-análisis

El re-análisis ya registraba que se ensayó: contra qué plan, con qué versión, quién y cuándo. **No registraba qué dio.**

Con eso, extender la vigencia de un lote 703 días es una afirmación sin evidencia. Es el mismo defecto que este proyecto viene corrigiendo en homologaciones, equivalencias y calibraciones: algo que se afirmó con respaldo, y el respaldo no está donde debería.

## Las lecturas van a la misma tabla, no a una nueva

La lectura de un re-análisis y la del ensayo de liberación son **la misma cosa medida en dos momentos**. Partirlas en dos tablas obligaría a unir las dos cada vez que se pregunta «¿qué midió este instrumento?», y la consulta que se olvidara de una devolvería una respuesta incompleta **sin avisar**.

Así que `ResultadoCaracteristicaCalidad` pasa a colgar de uno de dos padres:

```
ControlCalidad      (liberación del lote granel)  ─┐
                                                   ├─→ ResultadoCaracteristicaCalidad
ReanalisisEnvasado  (vigencia nueva del envasado) ─┘
```

**Exactamente uno**, garantizado por la base y no por la disciplina de quien escribe:

```sql
CHECK (num_nonnulls("controlCalidadId", "reanalisisId") = 1)
```

Va en la base porque una lectura huérfana **no la ve nadie**: todas las pantallas entran por su padre. Sería un dato que existe y no se puede encontrar. Prisma no modela `CHECK`, así que esa línea de la migración es lo único que lo impide.

Comprobado contra PostgreSQL:

```
ERROR:  new row for relation "resultados_caracteristica_calidad"
        violates check constraint "resultados_caracteristica_calidad_un_solo_ensayo"
```

## El resultado ya no lo elige quien carga

Si se declara un plan, `APROBADO`/`RECHAZADO` **sale de las mediciones** contra la especificación del plan. Antes lo elegía el formulario, y nada impedía aprobar un re-análisis cuyas propias lecturas estaban fuera de rango — la contradicción exacta que este registro existe para evitar.

Encadenado con la regla que ya existía, queda:

> lectura fuera de especificación ⇒ resultado `RECHAZADO` ⇒ **no puede extender la vigencia**

Verificado en el navegador de punta a punta: con densidad `0.95` (especificación 0.86–0.90) el formulario muestra *«Resultado calculado: Rechazado»* y el servidor responde *«Un ensayo con resultado RECHAZADO no puede extender la vigencia»*.

Sin plan declarado el resultado sigue siendo del operador: no hay contra qué contrastarlo, y exigir un plan que la empresa no cargó bloquearía el registro de algo que sí ocurrió.

## Una operación que estaba escrita una sola vez y hacían falta dos

Armar los resultados a partir del plan y las lecturas —validar que correspondan, copiar la especificación dentro de cada resultado, resolver el instrumento— vivía dentro de `registrarCalidad`. Al necesitarla en el re-análisis se extrajo a `resultadosDelEnsayo` en `src/lib/planesCalidad.ts`, en vez de copiarla: **así es como dos ensayos terminan aplicando criterios distintos sin que nadie lo haya decidido.**

La especificación se copia dentro del resultado a propósito. El plan puede cambiar mañana, y el ensayo tiene que poder leerse tal como se hizo.

## Y se revisa como todo lo demás

Un re-análisis medido con un instrumento sin calibración vigente **aparece en «Qué hay que reensayar»**, junto a las liberaciones. Dejarlo fuera habría sido peor que no tener la pantalla: diría «no hay nada que reensayar» habiendo trabajo.

La lista distingue las dos clases porque la consecuencia es distinta:

| Ensayo | Lo que queda en cuestión | Qué se lista |
| --- | --- | --- |
| Liberación del lote | que el lote cumpliera al liberarlo | el lote granel |
| Re-análisis de vigencia | la vigencia que se le dio | el envasado |

Un mismo lote puede aparecer dos veces —su liberación y el re-análisis de uno de sus envases— porque son **dos trabajos distintos**: reensayar el granel no arregla la vigencia del envase, ni al revés.

El despacho de un re-análisis se cuenta sobre **ese envasado**, no sobre todos los del lote: la vigencia se le dio a ese envase.

## Verificación en navegador (`erp_dev`)

1. Re-análisis de `ENV-00003` con `Densidad a 15 C = 0.88 kg/L` medida con `DM-01`. El historial pasa a mostrar la medición con su especificación y su instrumento:

   > 17 set. 2026 · APROBADO · vencía 14 oct. 2026 · pasó a 17 set. 2028 · **Extendió 703 días**
   > `Densidad a 15 C: 0.88 kg/L (0.86 a 0.9) · DM-01`

2. Como `DM-01` volvió fuera de tolerancia, ese re-análisis entra solo en la lista de reensayo, con su propia consecuencia:

   | Lote / envasado | Ensayo | Qué queda sin respaldo | Dónde está |
   | --- | --- | --- | --- |
   | LG-00001 | Liberación del lote | En duda | Ya está en poder del cliente — 120 un. / 5 clientes |
   | ENV-00003 | Re-análisis de vigencia | Sin calibración vigente | Ya está en poder del cliente — 54 un. / 4 clientes |
   | LG-00004 | Liberación del lote | En duda | Todavía en almacén |

3. La ficha del instrumento lista las tres, cada una con su clase de ensayo.

`tests/mediciones-del-reanalisis.test.ts`: 21 pruebas. Guardas comprobadas reintroduciendo el defecto: hacer que el servidor confíe en el resultado del formulario hace fallar la prueba correspondiente; el `CHECK` se comprobó insertando una lectura huérfana directamente contra PostgreSQL.

## Lo que queda fuera, y por qué

- **El certificado de análisis no incluye el re-análisis.** Hoy imprime el ensayo de liberación. Si un cliente que recibe producto re-analizado debe ver ese ensayo en su certificado es una decisión de calidad y comercial, no técnica.
- **Sin plan declarado no hay mediciones.** El campo de observaciones sigue recogiendo lo que el laboratorio quiera asentar. Exigir un plan bloquearía el registro de algo que ocurrió.
- **Sigue sin bloquear ni advertir al liberar** con un instrumento sin calibración vigente: la misma decisión de calidad pendiente desde hace tres ciclos.
- **La ficha del instrumento mezcla hasta 300 lecturas de cada clase y muestra 50.** Con volumen real hará falta filtrar por fecha.
