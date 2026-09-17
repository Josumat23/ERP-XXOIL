# El certificado dice con qué se midió y si la vigencia fue revalidada

Dos cosas que el sistema sabía y el documento callaba. El negocio lo decidió el **2026-09-18**; hasta entonces figuraban como pendientes en tres ciclos distintos, porque cambiar lo que ve un cliente no es una decisión técnica.

## 1 · Con qué equipo se midió

El instrumento va **bajo el método**, no en columna propia: en un documento que se imprime, una columna más aprieta todo lo demás.

```
#  Característica          Método / equipo              Especificación   Resultado    Conformidad
1  Densidad a 15 C         ASTM D1298                   0.86 a 0.92 kg/L 0.8871 kg/L  Conforme
                           DM-01 — Densímetro digital
2  Penetración 60x         ASTM D217                    265 a 295        278          Conforme
                           PEN-01 — Penetrómetro de grasas
```

### Lo que deliberadamente NO se imprime

**Si la calibración de ese equipo estaba vigente.**

El equipo es un **hecho** del ensayo. Si su calibración se sostenía es algo que el sistema **deriva** del historial, y afirmarlo —o negarlo— en un documento que va al cliente es criterio de calidad, no un dato.

El sistema ya lo dice donde corresponde: en «Qué hay que reensayar», antes de que el producto salga. Hay una prueba que impide que esa derivación se cuele al certificado.

## 2 · Si la vigencia fue revalidada

Un lubricante no se echa a perder al llegar su fecha: el laboratorio vuelve a ensayarlo y, si sigue en especificación, le da vigencia nueva.

**Quien recibe producto con la fecha extendida tiene derecho a ver que la extensión se sostiene en un ensayo y no en una decisión administrativa** — que es, exactamente, la diferencia entre revalidar y reetiquetar.

```
Revalidación de vigencia
Envase                    Fecha              Resultado  Vigencia                    Mediciones del re-ensayo
ENV-00003                 17 set. 2026       APROBADO   14 oct. 2026 → 17 set. 2028 Densidad a 15 C: 0.88 kg/L · DM-01
vence 17 set. 2028
```

### El certificado es del lote; los re-análisis son de cada envase

Un lote puede tener varios envases y solo algunos revalidados. Por eso cada fila **dice de qué envase habla** y muestra su vigencia actual: quien recibe el `EV-00003` tiene que poder encontrar el suyo y no leer el de otro.

### Un re-ensayo rechazado también se imprime

Imprimir solo los aprobados sería elegir qué parte de la historia se cuenta. Un `RECHAZADO` no extiende la vigencia —eso lo impide el registro, no el documento— pero consta que se ensayó.

### La sección no aparece si no hay revalidaciones

Un encabezado con una tabla vacía en un documento impreso hace dudar de si falta información.

## Verificación en navegador (`erp_dev`)

Certificado del lote `LG-00003`, que tiene ensayo de liberación y un envase revalidado. Las dos secciones nuevas salen con sus datos, y sigue sin imprimirse la homologación vencida (guarda de un ciclo anterior sobre el mismo archivo).

`tests/certificado-instrumento-y-reanalisis.test.ts`: 8 pruebas.

## Lo que queda fuera, y por qué

- **No hay un certificado por envase.** El documento sigue siendo del lote; la sección de revalidación distingue los envases dentro de él. Un certificado por envase es otra decisión y cambiaría a qué se enlaza desde la factura.
- **No se imprime el certificado de calibración del equipo** (número y entidad). El código del instrumento alcanza para rastrearlo; incluir el certificado convertiría el documento en un expediente.
- **La calibración vigente no se afirma ni se niega**, por lo dicho arriba.
