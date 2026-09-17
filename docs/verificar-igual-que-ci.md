# `npm run verificar`: lo mismo que corre CI, antes de abrir el PR

Mi verificación local y la de CI no eran la misma lista, y la diferencia se descubría **once minutos después**, en el PR ya abierto.

Pasó hoy: todo verde en local, PR abierto, y CI falló por espacios de alineación en el schema.

## Las dos divergencias

| Paso | Local (antes) | CI |
| --- | --- | --- |
| `prisma format --check` | **no se corría** | sí |
| `npm run lint` | sin banderas | **`-- --max-warnings=0`** |

La segunda no la conocía hasta que leí el flujo para escribir este script: **una advertencia de ESLint pasa en local y rompe el PR.**

## Qué hace

Los siete pasos que CI ejecuta después de preparar la base, en el mismo orden, deteniéndose en el primero que falla:

```bash
npm run verificar
```

```
[1/7] Cliente de Prisma — npx prisma generate          ✔ 7 s
[2/7] Formato del schema — npx prisma format --check   ✔ 1 s
[3/7] Schema válido — npx prisma validate              ✔ 1 s
[4/7] Lint — npm run lint -- --max-warnings=0          ✔ 32 s
[5/7] TypeScript — npx tsc --noEmit                    ✔ 4 s
[6/7] Pruebas — npm test                               ✔ 484 s
[7/7] Build — npm run build                            ✔ 31 s
```

Al fallar dice **qué paso**, cuánto tardó, que CI va a fallar igual, y que los siguientes no se ejecutaron. Seguir después de un fallo llenaría la pantalla de errores derivados y escondería el primero, que es el único que importa.

## Lo sincroniza una prueba, no un comentario

Un comentario que pide mantener dos archivos alineados no alinea nada. `tests/verificacion-local-igual-que-ci.test.ts` lee `.github/workflows/ci.yml`, extrae sus comandos y comprueba que todos estén en el script. **Si CI gana un paso y el script no, falla.**

## Dos defectos que el propio ciclo encontró

**1. La comparación pasaba por vacía.** El parseo del YAML quitaba el prefijo `run:` *después* de filtrar, así que los pasos de una sola línea (`run: npx prisma generate`) no empezaban por «npx» y se perdían. La guarda habría quedado en verde comparando casi nada.

Lo detectó una segunda prueba de sanidad que exige haber leído al menos cinco comandos. Es el mismo patrón que ya apareció hoy con una prueba de aislamiento que se saltaba en silencio: **una guarda que no comprueba nada es peor que ninguna, porque además tranquiliza.**

**2. `tsc` fallaba por un archivo generado.** `next dev` escribe tipos en `.next/dev/types`, que entran al `tsc` del proyecto. Interrumpir el servidor los deja truncados y `tsc` falla señalando algo que nadie escribió:

```
.next/dev/types/routes.d.ts(254,1): error TS1434: Unexpected keyword or identifier.
```

Un script pensado para dar confianza habría dado un fallo por algo ajeno al código, y a la segunda vez nadie le cree. CI nunca tiene ese archivo, así que **borrarlo antes de typechequear es parecerse más a CI, no menos.**

Los dos habrían sobrevivido a una revisión de código. Ninguno sobrevivió a ejecutar la cosa.

## Verificación

Corrida completa: **7/7 pasos, 866 pruebas, 559 s, `SALIDA_REAL=0`**.

La guarda se comprobó quitando un paso del script: falla nombrando el comando que CI corre y el script no.

## Lo que queda fuera, y por qué

- **No reproduce el entorno de CI**, solo sus comandos: CI levanta PostgreSQL 17 y crea su base; acá se usa la instancia local. Si algo depende de la versión del motor, se sigue descubriendo en el PR.
- **No hay modo rápido.** Un subconjunto que «casi» equivale a CI es exactamente el problema que este script resuelve. Para iterar sigue estando `npm test -- <filtro>`.
- **Los pasos previos de CI** —instalar dependencias, levantar el servicio de base— no se replican: en local ya están.
