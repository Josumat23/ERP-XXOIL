# Los paneles genéricos no comprobaban la compañía

Adjuntos, contactos y direcciones se montan sobre **cualquier** ficha con un par `entidadTipo` + `entidadId` que llega del navegador. Cada uno se preguntaba por su cuenta si esa entidad existe, y las tres respuestas se habían separado:

| Tipo | ¿Comprobaba la compañía? | ¿El modelo tiene `empresaId`? |
| --- | --- | --- |
| Cliente | **sí** | sí |
| Proveedor | **sí** | sí |
| Empleado | no | **sí** |
| Insumo | no | **sí** |
| OrdenCompra | no | **sí** |
| Equipo | no | **sí** |
| ActivoFijo | no | **sí** |

Cinco de siete solo comprobaban que el id existiera. Y el rol se comprueba por **tipo** de entidad, no por compañía: un usuario con permiso de RRHH en una compañía lo tiene sobre «Empleado» a secas.

Así que, sabiendo un id, se le podía colgar un adjunto al empleado de otra compañía, borrarle una dirección, o **descargarse el archivo adjunto de su activo fijo**.

Es la clase de defecto que las instrucciones del proyecto nombran con todas las letras: una Server Action es un POST que no se controla, y el id que manda el navegador no se cree hasta comprobarlo contra la compañía activa.

## La fuga, demostrada y cerrada

No es una deducción. Se montó el caso en `erp_dev`: una segunda compañía con un empleado, un adjunto suyo y un archivo real en disco con la frase «CONTENIDO CONFIDENCIAL DE OTRA EMPRESA». Desde una sesión de la compañía 1:

| Código | `GET /api/adjuntos/<id>` |
| --- | --- |
| Con la comprobación vieja | **200** y el contenido del archivo |
| Con la comprobación nueva | **404** |

Entre una medición y la otra solo cambió la comprobación. El montaje se borró después, archivo incluido.

## Una sola pregunta, en un solo lugar

`src/lib/entidadesDeLaEmpresa.ts` contesta «¿este registro es de la compañía activa?» para los siete tipos, **todos** por `id` + `empresaId`. Los tres paneles delegan ahí.

La tabla de comprobaciones es un `Record` exhaustivo a propósito:

```ts
const COMPROBACION: Record<EntidadDeLaEmpresa, (id, empresaId) => Promise<boolean>> = { … }
```

Agregar un tipo de entidad **no compila** hasta decir cómo se acota. Un `switch` con `default` deja que el próximo tipo entre sin acotar — que es exactamente lo que pasó.

Sin `empresaId` contesta que no. No es un descuido heredado: quien llama desde una Server Action siempre tiene la compañía a mano, y dejar pasar cuando falta convertiría un olvido en un agujero silencioso. Esa regla ya existía para Cliente y ahora rige para todos.

## Doble llave en la ruta de descarga

`GET /api/adjuntos/[id]` entrega **bytes** y el id viaja en la URL. Ahora el adjunto se busca por `id` + `empresaId` —lo lleva encima— además de comprobar la entidad. Bastaría con lo segundo; la redundancia es deliberada, para que un tipo de entidad nuevo mal acotado no se convierta en una descarga.

## Lo que no cambió

El modelo `Direccion` genérico sigue **sin `empresaId`** y fuera del aislamiento multiempresa, como se anotó el 2026-09-14. Este ciclo cierra el acceso —ninguna escritura ni lectura llega ya a una entidad de otra compañía— pero no decide el futuro del modelo: retirarlo de Proveedores y Empleados, como se hizo con Clientes, necesita un reemplazo tipado para cada uno y es un cambio de otro tamaño. Queda anotado, no corregido.

## Pruebas

`tests/aislamiento-paneles-genericos.test.ts`: 8 pruebas.

La primera **recorre la lista de tipos**, no una muestra: monta dos compañías con un registro de cada tipo y comprueba, para los siete, que el propio se reconoce y el ajeno se rechaza. Si mañana alguien agrega un tipo, la prueba lo recorre sin que nadie se acuerde de sumarlo.

Otra reproduce el agujero: comprueba que el registro ajeno **existe** —o sea que la comprobación vieja contestaba «sí»— antes de comprobar que la nueva contesta «no».

Reintroduciendo la falta de `empresaId` en un solo tipo, **4 de las 8 se ponen en rojo**.

---

## Actualización: las filas mismas entran al aislamiento

El ciclo anterior cerró el acceso —ninguna escritura ni lectura llega ya a una entidad de otra compañía— pero dejó anotado que el modelo genérico seguía **sin `empresaId`**.

Medido, resultaron ser **los dos únicos** modelos polimórficos sin compañía: `Direccion` y `Contacto`. `Adjunto` ya la tenía.

En la práctica se acotaban por la entidad padre, que sí la lleva. Pero la fila en sí no se podía filtrar ni contar por compañía, y cualquier consulta nueva nacía sin red: el filtro dependía de que quien la escribiera se acordara de pasar por la entidad.

### No hacía falta la decisión que estaba pendiente

Estaba anotado desde el 2026-09-14 como «pendiente de decisión propia», y por eso quedó tres ciclos sin tocarse. La decisión pendiente era **retirar** el modelo de Proveedores y Empleados, como se hizo con Clientes — y eso sí lo es, porque habría que inventar qué significa una dirección tipada para un proveedor (¿recojo?) y para un empleado (¿domicilio?).

Agregarle la compañía no decide nada: preserva la funcionalidad tal como está y cierra el hueco.

### La migración es correcta en cualquier base, no solo en ésta

Las dos tablas están **vacías** —comprobado en `erp_dev` y en la base demo—, así que el relleno no toca nada. Se escribe igual:

1. La columna se agrega **nullable**.
2. Se rellena desde la entidad padre, por cada uno de los tres tipos polimórficos.
3. Las filas **huérfanas** —cuya entidad ya no existe— se borran: sin padre no hay compañía que asignarles, y dejarlas obligaría a inventarles un dueño. Una dirección que no cuelga de nadie no la puede ver ni corregir nadie.
4. Recién entonces la columna se vuelve obligatoria, con su clave foránea y su índice.

Agregarla `NOT NULL` de una haría fallar la migración en cualquier instalación con datos.

### Y el borrado deja de leer por id a secas

`eliminarDireccion` y `eliminarContacto` leían la fila por id y comprobaban la compañía **después**, contra la entidad. Ahora la fila lleva la suya y se busca ya acotada: `findFirst({ where: { id, empresaId } })`.

### Una guarda que falló por su propia sintaxis

La primera versión de la prueba armaba la expresión regular interpolando el nombre del modelo, y un escape mal puesto la dejó comparando contra un patrón inválido: dio **en rojo sobre código correcto**. Se cambió por una comparación literal. Una guarda que falla por cómo está escrita no dice nada sobre lo que vigila.

Reintroduciendo los dos defectos —quitar la compañía del panel y volver a leer por id a secas— las dos guardas se ponen en rojo.
