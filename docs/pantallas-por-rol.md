# El menú esconde el enlace; la pantalla es la que cierra la puerta

`src/lib/navegacion.ts` declara, enlace por enlace, qué roles pueden verlo: `/rrhh/planilla` lleva `roles: ["ADMIN", "GERENCIA"]`. El Sidebar lo usa para no dibujar lo que al usuario no le toca.

No dibujar un enlace no impide escribir la dirección. `src/lib/permisos.ts` lo dice en sus propios comentarios: **«el rol sigue siendo la puerta principal de cada pantalla»**. Lo que faltaba era comprobar que así fuera.

`npm run pantallas:por-rol` pide las 108 pantallas con un usuario de cada rol, por HTTP. No inventa ninguna regla: la declaración de la navegación **es** la afirmación de la aplicación, y esto la contrasta con lo que el servidor responde.

## Lo que encontró

**Cinco pantallas que el menú escondía y la URL abría igual.**

| pantalla | la abría |
|---|---|
| `/comercial/descuentos-canal` | ALMACEN, PRODUCCION |
| `/finanzas/conciliacion-bancaria` | ALMACEN, PRODUCCION, VENTAS |
| `/proyectos` | ALMACEN, PRODUCCION, VENTAS |
| `/rrhh/posiciones` | ALMACEN, PRODUCCION, VENTAS |
| `/logistica/devoluciones-clientes` | VENTAS, GERENCIA |

Las cinco tenían exactamente la misma forma:

```ts
const usuario = await obtenerUsuario();
if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
```

`puedeRealizar` mira el **grupo de seguridad**, no el rol, y el grupo solo puede *restringir* dentro de un módulo al que el rol ya da acceso — nunca ampliar. Su primera línea útil es `if (!usuario.grupoSeguridadId) return true;`. Sin grupo asignado, que es el caso normal, devuelve `true` a cualquiera con sesión. Ninguna de las cinco nombraba el rol ni una vez.

Y una en la dirección contraria: **`/proyecciones`**, que el menú le ofrecía a ALMACEN y la pantalla rechazaba. La lista de roles estaba escrita a mano dentro de la página y la navegación no la tenía. Un enlace muerto.

## El arreglo: una sola lista

Las dos copias de la lista de roles —la de la navegación y la de cada pantalla— es el lugar donde esto puede volver a pasar. `src/lib/accesoPantalla.ts` expone `puedeVerPantalla(rol, href)`, que lee la declaración de la navegación, y las seis pantallas la usan en vez de repetirla. El grupo de seguridad se sigue comprobando después, y puede restringir más.

A nadie se le cambió lo que podía ver: a las cinco se les puso la puerta que el menú ya decía que tenían, y a `/proyecciones` se le copió a la navegación la lista que la pantalla ya exigía.

## Ojo con el 200

La primera corrida informó **118 pantallas abiertas sin permiso** — todas las vedadas, de todos los roles. Era falso.

Una pantalla que rechaza con `redirect("/")` no responde 307 acá. Estas páginas son asíncronas y se transmiten en streaming, y la documentación de Next lo dice: *«when used in a streaming context, this will insert a meta tag to emit the redirect on the client side»*. El servidor responde **200** con el armazón y esto adentro:

```html
<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/"/>
```

El cuerpo no trae ni un dato de la pantalla, pero el estado dice 200. Mirar solo el código de estado convierte cada pantalla protegida en un hallazgo. Abrirse es responder 200 **sin** esa etiqueta.

Vale anotarlo porque el error no estaba en la aplicación sino en la comprobación, y en la dirección más peligrosa: una lista de 118 agujeros inventados habría llevado a «revisar» cinco docenas de pantallas que estaban bien, y a no creerle a la lista cuando trajo los cinco de verdad.

## Las dos direcciones

- **vedada** → tiene que no abrirse.
- **permitida** → tiene que abrirse.

Sin la segunda, una aplicación que redirigiera todo a todo el mundo pasaría en verde. Es la misma trampa que una consulta que no devuelve nada. Las 108 permitidas de cada rol se abren, y eso es lo que hace que el resultado signifique algo.

## Que la comprobación sea capaz de fallar

No hizo falta introducir un defecto: los cinco estaban. El mismo comando, con el mismo criterio, antes y después del arreglo:

```
antes:   ✖ 13 pantalla(s) que el menú esconde y la URL abre igual
         ✖ 1 pantalla(s) que el menú ofrece y el servidor no abre
después: ✔ Cada rol abre exactamente las pantallas que la navegación le declara
```

En la suite quedan seis guardas que no necesitan servidor: que toda declaración de roles apunte a una pantalla que existe, que ninguna pantalla restringida deje de mirar el rol, que las seis corregidas lean la lista de la navegación, el comportamiento de `puedeVerPantalla`, y que el comando no se quede mirando el código de estado ni comprima las dos direcciones. Quitándole la guarda a `/proyectos` se ponen en rojo nombrándola.

La comprobación estática es a propósito laxa: le alcanza con que la pantalla **mencione** el rol. Basta para lo que se encontró y no se equivoca con las que lo comprueban con otro nombre de variable —`/configuracion/usuarios` usa `actual.rol`—. No prueba que mire el rol *correcto*: eso lo hace el comando, contra el servidor.

## Cómo se corre

```bash
npm run dev:demo            # en otra terminal
npm run pantallas:por-rol
```
