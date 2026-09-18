# ¿Alguna pantalla muestra datos de otra compañía?

El aislamiento multiempresa es la preocupación más documentada del proyecto —más de veinte documentos— y las pruebas lo verifican **consulta por consulta**.

Lo que ninguna verificaba es el **resultado**: lo que la pantalla renderiza con otra compañía activa. Una consulta puede estar bien y la pantalla mostrar datos ajenos por otro camino — un componente compartido, un `include` anidado, un panel que se monta con un id.

`npm run fugas:entre-empresas` lo comprueba de punta a punta, por HTTP.

## Dos compañías, ambas con datos

Con una compañía vacía solo se detecta «la consulta no filtra». Con **dos pobladas** se detecta además «filtra por la compañía equivocada», que es el error más silencioso de los dos: la pantalla muestra algo, parece correcta, y es de otro.

El script toma los nombres y códigos con los que cada compañía se reconoce en pantalla —clientes, lotes, apellidos de empleados, instrumentos, tanques, proveedores, envasados—, descarta los que **ambas** usan (coincidir en un nombre no prueba nada) y busca los ajenos en cada pantalla.

Y lo hace en **las dos direcciones**. Con una sola, una consulta que filtrara siempre por la compañía equivocada pasaría a medias.

## Sobre el texto visible, no sobre el HTML

La primera versión dio un falso positivo: encontró `DM-01` en la pantalla de instrumentos con la segunda compañía activa. No era un dato — era el **placeholder** del campo «Código» en el formulario de alta, y la lista decía correctamente «Todavía no hay instrumentos cargados».

Ahora se comparan solo las etiquetas, atributos y scripts fuera: lo que una persona ve. Una comprobación que marca lo que no es se termina ignorando.

## El resultado

**28 pantallas, las dos direcciones, ninguna fuga.** Incluye las dos que este ciclo y el anterior tocaron —instrumentos y los paneles genéricos— y las que se sembraron esta semana: tanques, RRHH, planilla, no conformidades, capacidad, guías.

## Que la comprobación sea capaz de fallar

Se le quitó a mano el filtro por compañía a la lista de clientes, y las dos direcciones se pusieron en rojo con los nombres exactos que se filtraron:

```
✖ 2 pantalla(s) con datos de la otra compañía:
   /comercial/clientes → Lubricentro El Rápido E.I.R.L., Distribuidora Ferretera del Norte S.A.C., …
   /comercial/clientes → Minera del Sur S.A.
```

Un primer intento de esta misma prueba pareció mostrar que la comprobación **no** detectaba nada. No era así: la edición que quitaba el filtro no había llegado a aplicarse —un reemplazo que no coincidió por los saltos de línea del archivo— así que el código seguía intacto y el verde era correcto. Vale anotarlo porque una demostración mal hecha lleva a la conclusión contraria a la verdadera.

## Cómo se corre

Necesita el servidor levantado contra la base demo con las dos compañías:

```bash
npm run dev:demo -- --reset      # en otra terminal
npm run fugas:entre-empresas
```

No entra en `npm test` porque necesita el servidor. En la suite quedan seis guardas baratas: que el comando exista, que fije la base demo y nunca mire `erp_dev`, que compare sobre texto visible, que recorra las dos direcciones, que descarte lo común y que **termine en rojo** cuando encuentra algo.
