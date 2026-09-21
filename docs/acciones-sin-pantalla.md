# Poder sin ver

El ciclo anterior comprobó que ninguna pantalla se abra para un rol que la navegación no declara. Falta la otra mitad: **la acción detrás de esa pantalla**, que es un endpoint POST y no necesita la pantalla para nada.

Son dos afirmaciones distintas, y las dos son legítimas:

- la navegación dice **quién ve** la pantalla;
- `requerirRol` dice **quién puede** hacer la operación.

**Ver sin poder es normal.** GERENCIA mira los descuentos por canal y no los edita; la acción pide `VENTAS` y está bien. Exigir que las dos listas coincidan daría falsos positivos en cantidad, y una comprobación que marca lo que no es se termina ignorando.

Lo que no tiene lectura razonable es lo contrario: **poder sin ver**. Una acción a la que llega un rol que no puede ni abrir la pantalla es un POST sin pantalla que lo respalde, y a la vez deja la pantalla inservible para quien sí la abre.

La regla es esa inclusión: los roles que una acción admite tienen que estar entre los que la navegación deja ver su pantalla. ADMIN pasa siempre, como en `requerirRol`.

## Lo que encontró

**De 27 archivos de acciones bajo una pantalla restringida, uno la incumplía.**

`/finanzas/propuesta-pago` es el pago masivo a proveedores —el equivalente reducido al F110 de SAP—. Tiene una sola acción, y exigía `ALMACEN`:

```ts
const auth = await requerirRol(["ALMACEN"]);
```

La navegación declaraba la pantalla para `["ADMIN", "GERENCIA"]`. Y `requerirRol` rechaza a todo el que no sea ADMIN ni esté en la lista. De modo que:

| rol | ¿abre la pantalla? | ¿pasa la acción? |
|---|---|---|
| ADMIN | sí | sí |
| GERENCIA | sí | **no** — «su rol no tiene permisos para realizar esta operación» |
| ALMACEN | **no** | sí |

**La pantalla no le servía a nadie salvo a ADMIN.** Gerencia la abría, seleccionaba las cuentas y cada envío le respondía que no tenía permisos. Almacén pasaba la acción pero no llegaba a la pantalla.

El origen se ve en el código: la acción reutiliza el mismo motor que el pago individual, `registrarPagoProveedor`, que es `ALMACEN`. El rol se copió con el motor.

## La decisión, que no se deduce del código

Las dos salidas eran coherentes y la diferencia no era técnica:

- **si la corrida de pagos la hace Almacén**, sobra la restricción del menú. La segregación ya existe aguas abajo: en cuentas por pagar, registrar un pago es `ALMACEN` y aprobarlo, rechazarlo o liberarlo es `GERENCIA`.
- **si la hace Gerencia**, la acción tiene que pedir `GERENCIA`.

Quién corre el pago masivo a proveedores en XXOIL no se decide leyendo el código, así que se preguntó. **La respuesta, el 2026-09-20: la corren las dos áreas, y la aprobación de cada pago sigue siendo de Gerencia** por el umbral que ya existe.

Aplicado en tres lugares, que eran tres copias de la misma lista:

| | antes | ahora |
|---|---|---|
| navegación | `["ADMIN", "GERENCIA"]` | `["ADMIN", "GERENCIA", "ALMACEN"]` |
| pantalla | `rol !== "ADMIN" && rol !== "GERENCIA"`, escrito a mano | `puedeVerPantalla(rol, href)` |
| acción | `requerirRol(["ALMACEN"])` | `requerirRol(["ALMACEN", "GERENCIA"])` |

La aprobación no se tocó, y hay una prueba que lo exige: si `aprobarPagoProveedor` dejara de ser exclusivo de Gerencia, la suite se pone en rojo. Aflojar el paso de arriba no puede aflojar el de abajo sin que se note.

`PENDIENTES_DE_DECISION` queda vacía. **La prueba exige que la lista de hallazgos sea exactamente esa lista**: si aparece otro caso, la suite se pone en rojo hasta que se resuelva o se anote con su motivo. Una excepción sin motivo se vuelve permiso permanente.

## Constantes y spread

La primera medición, por expresiones regulares, dio **seis** hallazgos. Cinco eran falsos: los archivos de RRHH y de proyecciones escriben `requerirRol([...ROLES_RRHH])`, con la lista en una constante del propio archivo, y una búsqueda de texto no la resuelve.

Cinco falsos de seis es peor que no medir: la parte real se pierde entre el ruido. La versión que quedó recorre el AST y resuelve las constantes y los `...spread` del archivo; de los seis queda uno.

## Que la comprobación sea capaz de fallar

Ocho pruebas, y las que importan corren la auditoría contra archivos de mentira: una acción que admite un rol que la pantalla no deja ver —tiene que aparecer—, y dos que están bien —una que pide exactamente lo que la pantalla deja ver, y otra bajo una pantalla sin roles declarados, que no restringe a nadie— para que no marque de más. Otra comprueba que «ver sin poder» no se marque, usando el caso real de los descuentos por canal. Y una fija la decisión de negocio en los tres lugares donde se aplicó, para que no se revierta en silencio.

## Cómo se corre

```bash
npm run acciones:sin-pantalla
```

Lee el código: no necesita base ni servidor. La misma comprobación corre dentro de `npm test`.
