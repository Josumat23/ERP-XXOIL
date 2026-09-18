# ¿Qué server action se puede llamar sin guarda?

Una server action no es una función interna. Next.js le publica un **endpoint POST** y cualquiera con la URL puede invocarla: sin pasar por la pantalla, sin el formulario, sin el botón que la esconde detrás de un permiso. Que el botón no se dibuje no impide nada.

La regla del proyecto es que ninguna confíe en quien la llama, y cada acción la cumple **a mano**: llama a `requerirRol` o a `obtenerUsuario` y comprueba el permiso. A mano quiere decir que la siguiente puede no cumplirla, y que nadie se enteraría hasta que alguien la llamara.

`npm run acciones:sin-guarda` recorre el código y lo comprueba. La misma auditoría corre dentro de `npm test`.

## Lo que encontró

**358 acciones: 288 en archivos `actions.ts` y 70 en línea. Todas autentican y todas comprueban rol o permiso.**

Las 70 en línea son la parte que importaba mirar. Son las de `<form action={async () => { "use server"; ... }}>`, escritas dentro de una página, que no aparecen en ningún `actions.ts` y no salen en una búsqueda por nombre de archivo. Ninguna lista las tenía contadas.

Quedan dos exentas, que son las que abren y cierran la sesión:

| | por qué |
|---|---|
| `iniciarSesion` | autenticar es lo que hace |
| el cierre de sesión en `layout.tsx` | solo borra la cookie de quien la manda |

La exención del cierre está definida por **lo que la acción hace** —que sus únicas llamadas sean `cerrarSesion` y `redirect`—, no por el archivo y la línea donde está. Una exención por posición se quedaría tapando lo que viniera después: basta que alguien agregue una línea arriba para que ampare a otra acción. Con esta, si al cierre de sesión se le agrega cualquier otra llamada, deja de estar exenta y se le vuelve a exigir guarda.

## Cómo lo recorre

Con el AST de TypeScript, no con expresiones regulares. Importa porque la guarda casi nunca está escrita en la acción: suele estar en un `autorizar()` privado del mismo archivo —así lo hacen todas las de transportistas— o, en las acciones en línea, en el `actions.ts` de al lado. Una búsqueda de texto marcaría en rojo las decenas de acciones que sí están protegidas, y una comprobación que marca lo que no es se termina ignorando.

Así que sigue el grafo de llamadas hasta el punto fijo, cruzando archivos por las importaciones con nombre, y pregunta dos cosas distintas:

- **autenticar** — ¿llega a `obtenerUsuario` o a `requerirRol`? Saber quién llama.
- **autorizar** — ¿llega a `requerirRol` o a `puedeRealizar`? Saber si ese puede.

Son dos porque la primera sin la segunda no sirve de mucho: cualquier usuario con sesión —el operario, el vendedor— es alguien conocido, y eso no lo habilita a borrar un plan de cuentas.

## Lo que NO prueba

Comprueba que la llamada **esté**, no que esté bien puesta. Una acción que autenticara dentro de un `if` y siguiera de largo por el otro camino pasaría esta comprobación. Detecta la ausencia, no la colocación; lo demás lo cubren las pruebas de cada acción.

Tampoco comprueba que el rol exigido sea el correcto: que `crearCategoria` pida `ALMACEN` y no `VENTAS` es una decisión de negocio que esto no puede leer.

## Que la comprobación sea capaz de fallar

Cinco de las nueve pruebas corren la auditoría contra archivos de mentira con el defecto puesto a propósito: una acción de archivo sin guarda, una **en línea** sin guarda, una que solo autentica y no comprueba permiso —y dos que sí están protegidas, una por un ayudante local y otra por otro archivo, para que no las marque de más—. Así la capacidad de detectar queda probada en cada corrida, y no una sola vez a mano.

La prueba del comando levanta un repositorio de mentira con una acción sin guarda y **lo ejecuta**: exige que salga con código 1. Una comprobación que informa y termina en verde no es una comprobación.

Y la afirmación sobre el repositorio de verdad se probó quitándole a mano la guarda a `crearCategoria`:

```
✖ ninguna server action del repositorio se puede llamar sin guarda
  actual: [ 'src/app/(app)/catalogo/categorias/actions.ts:13 crearCategoria' ]
```

Queda además una prueba que exige encontrar **más de 300** acciones y **más de 50** en línea: si una refactorización dejara de reconocerlas, la comprobación daría verde por no estar mirando nada.

## Cómo se corre

```bash
npm run acciones:sin-guarda            # informe
npm run acciones:sin-guarda -- --detalle   # acción por acción
```

No necesita base ni servidor: lee el código.
