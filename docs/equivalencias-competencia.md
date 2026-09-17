# «¿Cuál es tu equivalente al Delvac 1340?»

Es la pregunta que más se repite en una venta de lubricantes, y el sistema no podía contestarla.

## Por qué no alcanza una tabla de sinónimos

La respuesta fácil es una tabla con dos columnas: producto de la competencia, producto nuestro. Es lo que hacen los ERP genéricos con sus *cross-references*, y no dice nada — si alguien pregunta **por qué** son equivalentes, la respuesta es «porque alguien lo tecleó».

Peor: no envejece. Una vez escrita la fila, sigue afirmando lo mismo para siempre, aunque lo que la sostenía haya dejado de ser cierto.

## Lo que se construyó

`ProductoCompetencia` guarda el producto ajeno y **de dónde salió** lo que se le atribuye: sin la fuente, dentro de dos años nadie sabrá contra qué se comparó. `EspecificacionCompetencia` guarda lo que su ficha dice cumplir, apoyándose en el mismo catálogo de especificaciones que usan los productos propios.

A esa ficha **no se le atribuye CUMPLE ni HOMOLOGADO**. No tenemos forma de saber cuál de las dos es, y suponerlo sería atribuirle al competidor algo que no dijo. Una prueba falla si alguien agrega ese campo.

`EquivalenciaProducto` es la declaración: qué producto nuestro reemplaza a cuál, con su motivo y su responsable.

## La cobertura se calcula; la equivalencia se declara

El sistema compara las especificaciones de las dos fichas y dice **qué cubre y qué no**. Lo que no hace es decidir: que dos lubricantes se reemplacen es criterio técnico y comercial —la viscosidad tiene que coincidir, el uso tiene que aplicar—, no aritmética de siglas. La declara una persona y queda con su nombre.

Tres reglas, todas sobre que la declaración no se contradiga:

- **Sin especificaciones del competidor no se puede declarar nada**, porque no hay contra qué comparar. El mensaje manda a cargar su ficha.
- **Con un hueco, el motivo es obligatorio** — pero declararla **no** se prohíbe. Hay razones legítimas: una norma nueva reemplaza a la anterior, o la faltante no aplica al uso. Bloquearlo sería inventar un criterio técnico que no es del sistema; exigir que la razón quede escrita, no.
- **Con cobertura total el motivo es opcional**, porque no hay nada que explicar. Pedirlo siempre lo convertiría en un campo que se rellena con cualquier cosa.

Los candidatos se muestran como **lista con su cobertura al lado**, no como desplegable: quien busca un reemplazo quiere comparar, no elegir a ciegas y enterarse después de qué le falta. Van ordenados por cobertura.

## Lo que una tabla de sinónimos no puede hacer: envejecer

**Una homologación nuestra vencida deja de cubrir.** Es la misma regla que rige el certificado de análisis: hoy no se puede afirmar una aprobación que dejó de regir.

La consecuencia es que la equivalencia **se degrada sola**. Se guarda la cobertura que había al declararla, se recalcula la de hoy, y la pantalla muestra el contraste — en rojo cuando bajó. Nadie tiene que acordarse de revisar: la fila lo dice.

## Verificación en navegador (`erp_dev`)

La secuencia completa, sobre el catálogo del ciclo anterior (GR-CHASIS declara API CK-4, ACEA E9 y Mercedes-Benz 228.31):

1. **Mobil Delvac 1340** cargado con su fuente.
2. Declarar una equivalencia sin especificaciones del competidor: rechazado con *«El producto de la competencia todavía no declara ninguna especificación, así que no hay contra qué comparar»*.
3. Cargadas las tres especificaciones de su ficha. GR-CHASIS aparece cubriendo **2 de 3**, sin cubrir **Mercedes-Benz 228.31** — porque **esa homologación nuestra estaba vencida**. Declara las tres; cubre dos. GR-LITIO aparece con **0 de 3**.
4. Declarada con motivo obligatorio (*«Renovación de la MB 228.31 en trámite; el uso no la exige»*).
5. **La degradación**: se quitó la declaración, se renovó la homologación —la cobertura pasó a **3 de 3** y el motivo dejó de ser obligatorio—, se declaró de nuevo, y después se dejó vencer la aprobación. Sin que nadie tocara la equivalencia, la fila pasó a decir en rojo: **«2 de 3 — bajó desde 3 de 3 al declararla»**, nombrando la que falta.
6. Vista inversa, desde nuestro producto: *Reemplaza a → Mobil Delvac 1340, cobertura hoy 2 de 3*.

El paso de renovar y vencer la homologación se hizo escribiendo en `erp_dev` directamente: representa el paso del tiempo, que no se puede esperar. Todo lo demás se hizo por pantalla.

`tests/equivalencias-competencia.test.ts`: 18 pruebas. Se verificó que la guardia detecta el defecto — al hacer que la pantalla muestre la cobertura guardada en vez de recalcularla, falla con *«no contrasta contra la del día de la declaración»*.

## Un cambio de diseño a mitad de camino

El selector de producto empezó siendo un `<select>` controlado con el motivo apareciendo debajo. Al ir a verificarlo en el navegador no se pudo: el harness no puede dispararle un `onChange` de confianza a un componente controlado por React —ya había pasado en el ciclo anterior—.

Se rehízo como **tabla de candidatos**, cada fila con su propio formulario y sin estado de cliente. Quedó mejor de lo que estaba: ahora se ven todos los candidatos con su cobertura y lo que les falta, en vez de uno por vez. Un obstáculo de verificación que terminó señalando un diseño peor.

## Lo que queda fuera

- **No llega a la venta.** Una cotización o un pedido no sugieren el equivalente cuando el cliente pide un producto de la competencia; hay que abrir la ficha. Esa es la conexión que falta para que el dato trabaje solo.
- **No hay aviso activo** cuando una equivalencia se degrada. La fila lo dice en rojo, pero solo para quien abre la pantalla — igual que el aviso de homologaciones por vencer.
- **La viscosidad no se compara aparte.** Si el negocio carga los grados SAE como especificaciones del catálogo (organismo SAE), entran en la cobertura como cualquier otra; si no, la comparación no las mira. No se le dio un tratamiento especial porque sería duplicar el mecanismo.
- **El catálogo no se siembra**, como el de especificaciones: qué competidores sigue XXOIL y qué dicen sus fichas es del negocio, y sembrar marcas reales además les atribuiría afirmaciones. Una prueba lo exige.
