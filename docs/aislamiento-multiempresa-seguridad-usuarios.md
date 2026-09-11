# Aislamiento multiempresa: grupos de seguridad y usuarios

Tercer y último tramo de la mitad de aplicación del ítem 0.2, y el que cierra los cinco módulos de Configuración que quedaban sin acotar.

## Supuesto adoptado

Un usuario y un grupo de seguridad pertenecen a **una** compañía. Un ADMIN que necesite administrar los de otra cambia primero la compañía activa.

No es una regla nueva: `Usuario.empresaId` ya existía con índice único `(empresaId, usuario)`, `GrupoSeguridad` con `(empresaId, codigo)`, y `obtenerEmpresaActivaId()` ya limita el cambio de compañía al rol ADMIN. Aplicar el mismo criterio que usan los otros 63 `actions.ts` es lo consistente. Si el negocio prefiere una administración central que vea todas las compañías a la vez, el cambio queda acotado a estos dos módulos.

## Qué cambia

### Grupos de seguridad

- `crearGrupoSeguridad` graba `empresaId: auth.usuario.empresaId`.
- `actualizarPermiso(permisoId, …)` resuelve el permiso con `findFirst({ where: { id, grupo: { empresaId } } })`. `PermisoGrupo` no lleva `empresaId` propio: la compañía se resuelve a través del grupo dueño. Un `permisoId` de otra compañía devuelve el mismo error de "ya no existe" que un id inventado, sin filtrar información.
- `alternarActivoGrupo` comprueba `perteneceAEmpresaActiva` antes del `esPredefinido`.
- La página lista solo los grupos de la compañía activa. Conviene saber que los grupos predefinidos solo se siembran para la compañía `"1"`: una compañía nueva empieza sin ellos.

### Usuarios

- `crearUsuario` graba `empresaId: auth.usuario.empresaId`.
- `existeGrupoSeguridadAsignable(id, empresaId)` pasa a exigir la compañía: un grupo activo de otra compañía deja de ser asignable. Afecta al alta y a `asignarGrupoUsuario`.
- `restablecerPassword`, `asignarGrupoUsuario` y `alternarActivoUsuario` releen el usuario y exigen que sea de la compañía activa. Restablecer una clave es la más sensible de las tres: además de la comprobación, devuelve un error explícito en vez de fallar en silencio, y sigue cerrando todas las sesiones del usuario afectado.
- La página lista solo los usuarios y los grupos asignables de la compañía activa.

## Verificación

La suite crea dos compañías con el mismo código de grupo `SOPORTE` y el mismo login `operador` en cada una —conviven porque los índices únicos llevan `empresaId`— y comprueba que `existeGrupoSeguridadAsignable` rechaza el grupo ajeno, que `perteneceAEmpresaActiva` rechaza el usuario y el grupo ajenos, y que el permiso no se resuelve desde la otra compañía.

La guardia de regresión cubre ya los cinco `actions.ts` de Configuración.

## Excepción

`configuracion/tareas-programadas` no se acota: dispara a mano las mismas tareas de mantenimiento que el servidor corre por temporizador, que operan sobre toda la base y no sobre una compañía.
