# Certificación periódica de accesos

Cierra el ítem GRC *Certificación periódica de accesos* del roadmap.

## Lo que había, y por qué no alcanzaba

`/configuracion/usuarios` ya mostraba la última conexión y **alertaba** sobre cuentas activas con más de 90 días sin acceso. El Blueprint 04 lo registraba con precisión: *«Verificado completo, alcance simple (alerta, no certificación formal)»*.

Una alerta avisa. Certificar es otra cosa: que alguien **declare por escrito** que cada acceso sigue siendo correcto, y que quede constancia de quién lo dijo y cuándo. Sin eso, ante un auditor no hay nada que mostrar más que una pantalla que en su momento tenía un aviso.

## La campaña congela lo que se revisó

Al abrirla se copia, línea por línea: nombre, usuario, rol, grupo, un resumen legible de lo que ese grupo permite, los conflictos de segregación detectados y la última conexión.

**Certificar contra datos vivos no certifica nada.** El revisor estaría aprobando algo que cambia debajo suyo, y un año después nadie podría decir qué fue lo que miró. Hay una guardia estructural que exige que esas copias existan en el modelo.

El resumen de permisos **deja fuera los módulos donde el grupo solo mira**: enumerar treinta permisos de lectura entierra los tres que importan. Si el grupo no hace nada más que ver, se dice «Solo lectura» en vez de dejarlo en blanco.

Los **conflictos de segregación** van al frente. La asignación ya los bloquea al guardar el grupo, así que en teoría no debería haber ninguno; si aparece uno, es justamente lo que una certificación tiene que poner delante de quien revisa.

## Nadie certifica su propio acceso

Es la mitad no ambigua de la segregación de funciones — la misma regla que ya rige en pedidos, pagos, órdenes de compra y vacaciones. Un control que el controlado puede firmarse solo no es un control. La pantalla ni siquiera ofrece el formulario en la propia fila, y el servidor lo vuelve a exigir.

No se pide, en cambio, que el revisor sea distinto de quien abrió la campaña: en una empresa con un solo administrador eso dejaría la certificación imposible de hacer, y la regla que sí importa ya está cubierta.

## Revocar aplica de verdad

Marcar «revocar» **desactiva la cuenta**. Una certificación donde esa casilla no hace nada es teatro: el acceso seguiría abierto y el papel diría que se quitó.

Es reversible desde Usuarios, que es donde se vuelve a otorgar bien, y queda en la auditoría de maestros como `DESACTIVAR`. **Revocar exige motivo** —confirmar no—, porque le quita el acceso a alguien y esa decisión tiene que poder releerse.

## Una certificación a medias no certifica nada

La campaña se cierra cuando **todas** las líneas tienen decisión. Lo que sí se puede es cancelarla con motivo.

Tampoco se abren dos campañas a la vez: serían dos verdades sobre el mismo acceso.

Y una campaña sin líneas nunca cuenta como completa — si `completa` fuera cierto con cero líneas, una campaña vacía se cerraría sola diciendo haber certificado todo.

## Lo que no se inventó

**No hay una cadencia por defecto.** Cada cuánto se certifican los accesos es política de la empresa, y el sistema no elige una: la campaña se abre cuando alguien decide abrirla. El roadmap condicionaba este ítem a que el número de usuarios creciera lo suficiente; se construyó el **mecanismo**, que no depende de esa escala, sin afirmar que el umbral se haya alcanzado.

## Verificación

**11 pruebas** (372 en total): el resumen que deja fuera lo de solo lectura, los conflictos de segregación, que nadie certifique su propio acceso, que revocar exija motivo y confirmar no, que una campaña cerrada no admita decisiones, que una campaña vacía no cuente como completa, la unicidad usuario–campaña, y tres guardias — que el modelo congele lo revisado, que revocar aplique y quede auditado, y que no se cierre con pendientes.

**En navegador**, sobre una base de demostración nueva:

| Caso | Resultado |
|---|---|
| Abrir campaña | `CA-00001` con los **cinco usuarios activos congelados** |
| Fila del propio admin | Sin formulario: «Su propio acceso: lo certifica otro administrador» |
| Elegir «Revocar» | Aparece el motivo obligatorio y el aviso de que desactiva la cuenta |
| Revocar al operario | Línea `REVOCADO` con motivo y revisor; cuenta en **`activo: 0`**; auditoría `DESACTIVAR` |
| **Intentar entrar como operario** | **Rechazado** — se quedó en `/login`; el log muestra `200` frente al `303` del ingreso válido |
| Forzar el cierre con 4 pendientes | **Rechazado por el servidor** aunque se salte el botón deshabilitado: la campaña siguió `ABIERTA` |

## Lo que este ciclo no hace

- **No programa la campaña** ni avisa cuando toca la siguiente: exigiría fijar una cadencia que es del negocio.
- **No revoca parcialmente.** La decisión es sobre el acceso de la persona, no sobre un módulo suelto: para ajustar permisos está el grupo de seguridad, y cambiarlo desde acá duplicaría esa pantalla.
- **No certifica grupos ni roles por separado**, solo el acceso efectivo de cada usuario, que es lo que un auditor pregunta.
