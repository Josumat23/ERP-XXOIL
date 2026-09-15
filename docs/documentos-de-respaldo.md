# Documentos de respaldo, y cuándo dejan de valer

Mitad del bloque 9 del maestro. La otra mitad —consentimientos de tratamiento de datos y política de retención— **no se construyó**, y eso está al final.

## Lo que faltaba no era el archivo

El DMS ya existía: `Adjunto` genérico, montado en siete pantallas, con su subida, su descarga y su borrado. Se podía guardar el contrato del cliente desde el primer día.

Lo que faltaba era saber **qué** es cada archivo y **cuándo deja de valer**. Sin eso, un contrato o una licencia vencidos no avisan a nadie hasta que alguien los busca — que suele ser el día en que hacen falta.

Dos columnas opcionales, `tipoDocumento` y `venceEl`. Opcionales a propósito: el DMS sirve también a insumos, equipos y órdenes de compra, donde la mayoría de los adjuntos son simplemente archivos y siguen funcionando igual.

La lista de tipos —contrato, ficha RUC, constancia bancaria, licencia, certificado— sale de lo que el negocio pidió guardar, no de una clasificación inventada.

## El aviso, y por qué no es un inventario

`documentosPorAtender` devuelve **solo** los vencidos y los que están por vencer, el más urgente primero. Listar también los vigentes convertiría el aviso en un inventario, y **un aviso que siempre tiene contenido deja de mirarse**.

En la fila de cada archivo, la fecha se pinta en rojo si venció y en ámbar si está por vencer; los vigentes, en gris como el resto.

## Decisiones que no son obvias

**Un documento que vence hoy todavía vale hoy.** Se comparan días completos: quien lo renueva hoy no está en falta.

**Treinta días de anticipación.** No sale de ninguna norma — es un criterio operativo, suficiente para renovar un contrato o una licencia sin corriendo. Está como constante con nombre, para poder discutirlo.

**No se puede poner vencimiento sin decir qué documento es.** Produciría un aviso que dice «archivo.pdf venció», que no le sirve a nadie. Y el aviso nombra el tipo —«Contrato comercial: venció hace 13 días»— cayendo en el nombre del archivo solo cuando no está clasificado.

**El vencimiento no bloquea nada.** Impedir vender porque alguien no actualizó un PDF sería inventar una regla de negocio que nadie pidió. Una guardia comprueba que ni pedidos ni facturas miren estos campos: si algún día se conectan, que sea una decisión explícita.

## Verificado en pantalla

Con cuatro documentos sembrados en la ficha de un cliente —uno vencido, uno por vencer, uno vigente y uno sin clasificar—:

```
Contrato comercial: venció hace 13 días.
Licencia: vence en 8 días.
```

El vigente y el archivo suelto no generan aviso, y aparecen en la lista como corresponde. Los datos de prueba se borraron después.

## Lo que no se construyó, y por qué

**Consentimientos de tratamiento de datos personales, su fecha y fuente, y la política de retención.**

Está en la lista de temas que el negocio marcó como **no desarrollables sin confirmación profesional**, junto con SST/IPERC y SIRE frente a PLE. Son obligaciones de la Ley 29733 cuyo alcance —qué se consiente, por cuánto tiempo se conserva cada dato, qué se hace al vencer el plazo— no es una decisión técnica.

Construirlo por cuenta propia produciría un registro de consentimientos que parece cumplimiento y no lo es, que es peor que no tenerlo: una pantalla que dice «consentimiento otorgado» sin respaldo legal detrás es una afirmación falsa sobre una obligación real.

Queda esperando esa confirmación.
