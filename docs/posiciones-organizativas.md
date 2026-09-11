# Posiciones organizativas versionadas (Oleada 1, HCM)

Antes la estructura de RR. HH. eran `Empleado.cargo` y `Empleado.area`, dos campos de texto libre, más `jefeDirectoId` entre personas. Con eso no se puede responder ni quién ocupaba una jefatura el año pasado ni qué posiciones están vacantes hoy: al rotar a la persona, el cargo anterior simplemente se sobrescribe.

## Los dos modelos

- **`PosicionOrganizativa`** existe con independencia de quién la ocupe: código, título, área, centro de costo y `reportaAId`. La jerarquía es **de posiciones, no de personas**, y por eso sobrevive a la rotación.
- **`AsignacionPosicion`** es la ocupación: empleado, posición, `vigenteDesde` y `vigenteHasta` opcional. Cerrar una y abrir otra conserva el histórico en vez de sobrescribirlo, igual que el resto del esquema.

`Empleado.cargo` y `jefeDirectoId` se conservan intactos: son la relación operativa vigente y el cambio es aditivo.

## Reglas que sí se aplican, y las que no

`vigenteHasta` es **exclusivo**: el día en que termina una ocupación es el primer día de la siguiente, así nunca hay dos ocupantes ese día por un error de borde.

Se impide una sola cosa: que **la misma persona ocupe la misma posición en dos períodos que se solapan**. Eso es integridad de datos.

Lo que **no** se impide, a propósito: que una posición tenga varios ocupantes a la vez, o que una persona ocupe dos posiciones en paralelo. Ambas son políticas de la empresa, no reglas técnicas, y el sistema no las inventa.

## Aprobación jefe→reporte

La otra mitad pendiente del ítem. Se cerró la parte no ambigua y se dejó explícita la que necesita una decisión.

**Cerrado:** las solicitudes de vacaciones no pueden ser resueltas por quien las pide. `puedeResolverSolicitud` ya se aplicaba en pedidos, cuentas por pagar, saldos a favor y órdenes de compra, y los cambios salariales bloqueaban al solicitante con una comprobación equivalente propia. Las vacaciones eran la única excepción: bastaba el permiso `rrhh: aprobar` y nada impedía aprobarse a uno mismo. No es una regla nueva — es la regla de la casa, aplicada donde faltaba.

**Pendiente de decisión:** si además debe exigirse que quien resuelve esté en la cadena de mando del solicitante, y con qué alcance — solo el jefe directo, cualquier superior de la cadena, o RR. HH. como alternativa válida cuando el jefe es el propio solicitante o la posición está vacante. Cada variante cambia quién queda bloqueado en la operación diaria, así que no se decide desde el código. `cadenaDeMandoPosicion` ya devuelve la cadena, de modo que implementar la variante elegida es acotado.

## Verificación

`tests/posiciones-organizativas.test.ts`: cobertura de fechas de borde (`vigenteHasta` exclusivo, períodos consecutivos que no se solapan, ocupaciones abiertas), la regla de solapamiento con sus tres casos que **no** deben bloquearse, las consultas por fecha, la jerarquía con ciclos y datos corruptos, y un escenario sobre base efímera donde una jefatura rota de ocupante y conserva ambos períodos. Una prueba más fija la segregación en las aprobaciones de RR. HH.
