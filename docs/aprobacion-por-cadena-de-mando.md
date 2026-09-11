# Aprobación por cadena de mando

Segunda mitad del ítem de estructura organizativa de RR. HH. La primera —que quien solicita no resuelve su propia solicitud— ya se cerró. Esta es la que quedaba: exigir que quien resuelve tenga relación de mando con el solicitante.

## Por qué es configurable

Cada variante bloquea a gente distinta en la operación diaria, y cuál corresponde depende de cómo trabaja la empresa. En lugar de elegir una y clavarla, la regla se configura en **Configuración → Empresa**:

| Opción | Quién resuelve |
| --- | --- |
| Sin jerarquía | Cualquiera con permiso de aprobación en RR. HH. Es el comportamiento histórico. |
| Solo el jefe directo | Únicamente el jefe directo del solicitante. |
| **Cualquier superior de la cadena** (por defecto) | El jefe directo o cualquiera por encima de él. |

En las tres, quien solicita nunca resuelve su propia solicitud: eso no es configurable.

## El respaldo de RR. HH., que es lo que evita el desastre

Una regla jerárquica sobre un organigrama incompleto deja solicitudes **sin nadie que pueda aprobarlas**, y eso se descubre el día que alguien necesita sus vacaciones.

Por eso las dos opciones jerárquicas traen respaldo: **si en la cadena del solicitante no hay nadie que pueda resolver de hecho —empleado activo con cuenta de usuario activa—, cualquiera con el permiso puede hacerlo.**

La consecuencia práctica importa: hoy, con el organigrama a medio cargar, la opción por defecto **no bloquea a nadie**. Y se endurece sola a medida que se cargan jefes directos, sin necesidad de volver a tocar la configuración. El respaldo mira solo a los habilitados por el alcance elegido: con "solo el jefe directo", que el gerente tenga cuenta no sirve si el jefe directo no la tiene.

## Qué hierarquía se usa

`Empleado.jefeDirectoId` — la relación operativa, que es la que está poblada. `PosicionOrganizativa.reportaAId` es su contraparte estructural y sobrevive a la rotación, pero exige que las posiciones estén asignadas; resolver por dos jerarquías a la vez duplicaría la semántica sin necesidad probada. Si las posiciones se vuelven el registro principal, `evaluarJerarquiaAprobacion` recibe las relaciones desde afuera, así que cambiar la fuente es acotado.

Quien aprueba puede no tener ficha de empleado —un administrador de sistema, por ejemplo—: en ese caso no está en ninguna cadena, y solo puede resolver si el respaldo está activo.

## Orden de los controles

1. **Permiso** (`rrhh: aprobar`) — la puerta principal, sin cambios.
2. **Segregación** — quien solicita no resuelve.
3. **Jerarquía** — esta regla, encima de las dos anteriores.

## Verificación

`tests/aprobaciones-jerarquia.test.ts`, sobre un organigrama de cuatro niveles (operario → supervisor → jefe → gerente) más un par que cuelga del mismo gerente:

- La cadena va del jefe directo hacia arriba, y un ciclo heredado no cuelga el recorrido.
- Con "solo el jefe directo", el jefe del jefe **no** alcanza.
- Con "cadena de mando", cualquier superior sí, pero un par del mismo gerente no.
- El respaldo entra cuando nadie de la cadena tiene cuenta activa, y **no** entra si al menos uno la tiene.
- Un solicitante sin jefe nunca queda bloqueado.
- Una guardia falla si las vacaciones dejan de aplicar la regla o de leerla de la configuración.

Recorrido en navegador: el selector aparece con las tres opciones, por defecto en "Cualquier superior de la cadena", la nota describe la opción elegida, y el cambio persiste tras guardar y recargar.

## Alcance actual

La regla se aplica hoy a las **solicitudes de vacaciones**. Los cambios salariales ya tenían su propia comprobación de segregación; extenderles la regla jerárquica es el paso natural siguiente, y usa la misma función.
