# Configuración de la sociedad, una por compañía

**Ítem 0.2b del roadmap.** Cierra el último eslabón del aislamiento multiempresa.

## El problema

El ítem 0.2 llevó los **79 modelos transaccionales** a tener clave foránea real hacia `Empresa`, y las **68** pantallas de acciones a filtrar por la compañía activa. Al auditar los Blueprints 03 y 05 contra el código apareció lo que había quedado fuera:

```prisma
model ConfiguracionEmpresa {
  id String @id @default("1")   // ← una sola fila para todo el sistema
  ...
}
```

Sin `empresaId`, sin relación hacia `Empresa`, y leída con `where: { id: "1" }` clavado en **once archivos**. Esa fila gobierna:

- razón social y **RUC del emisor** de todo documento impreso,
- moneda y **tasa de IGV**,
- **credenciales SUNAT**: certificado digital, contraseña, usuario y clave SOL, token del OSE,
- umbrales de aprobación de compras y de pagos,
- alcance de la aprobación jerárquica de RR. HH.,
- tarifa de mano de obra, recargo por mora y tasas de financiamiento.

Con dos sociedades legales reales, la segunda **emitía sus facturas con el RUC y las credenciales SUNAT de la primera**, y calculaba su IGV con la tasa de la otra.

Con una sola compañía operando —el caso actual— ningún flujo estaba roto. Era el eslabón que faltaba para que el trabajo del ítem 0.2 sirviera de verdad, no una falla presente.

## La solución

`ConfiguracionEmpresa` pasa a tener una fila por compañía:

```prisma
model ConfiguracionEmpresa {
  id        String  @id @default(cuid())
  empresaId String  @unique @default("1")
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Restrict)
  ...
}
```

- El `id` deja de ser la constante `"1"`. La fila histórica **conserva el suyo** —es la de la compañía principal— y las nuevas reciben un cuid.
- La clave real de lectura es `empresaId`, con índice único: una compañía no puede tener dos configuraciones.
- `onDelete: Restrict`, igual que el resto del grafo: borrar una compañía con configuración se rechaza en la base.

El acceso único es `obtenerConfiguracionEmpresa(empresaId, cliente?)` en `src/lib/empresa.ts`:

- **`empresaId` es obligatorio, sin valor por defecto.** Un valor por defecto haría que un llamador distraído leyera la configuración de la compañía principal sin ningún error visible — exactamente la fuga que este cambio cierra. Al quitarlo, TypeScript señaló los trece puntos que había que revisar.
- Acepta un `TransactionClient` opcional, para los llamadores que ya están dentro de una transacción.
- Si la compañía no tiene configuración, la crea con los **valores por defecto del esquema**. No copia nada de otra compañía: razón social, RUC, certificado y credenciales SUNAT pertenecen a la sociedad que los contrató, y heredarlos haría que una compañía nueva emitiera con la identidad tributaria ajena.
- Usa `upsert` y no `create`: dos peticiones simultáneas de la misma compañía llegan aquí a la vez, y el índice único convertiría al segundo `create` en un error en vez de devolverle la fila que ya existe.

## El cerrojo de los correlativos, efecto colateral que la migración destapó

`reservarCorrelativo()` tomaba el cerrojo de la numeración así:

```sql
INSERT INTO configuracion_empresa (id, actualizadoEn)
VALUES ('1', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET id = excluded.id
```

Es decir: usaba **la fila de configuración como mutex**, dando por hecho que había una sola. Con una fila por compañía ese `INSERT` deja de chocar contra la clave primaria y choca contra el índice único de `empresaId`, y **toda** generación de correlativo falla con `SQLITE_CONSTRAINT_UNIQUE`. Lo detectó la suite, no el navegador.

El arreglo no fue parchear el `ON CONFLICT`, sino quitar el acoplamiento: el cerrojo vive ahora en su propia tabla.

```prisma
model CerrojoCorrelativo {
  id            String   @id @default("1")
  actualizadoEn DateTime @default(now())
  @@map("cerrojo_correlativo")
}
```

No guarda ningún dato de negocio. Un mecanismo de concurrencia no debe depender de qué filas de negocio existan. El cerrojo sigue siendo **deliberadamente global** —la numeración se serializa entre todas las compañías, como antes— y el `INSERT ... ON CONFLICT DO UPDATE` sigue siendo portable a PostgreSQL, que era la condición que el roadmap exigía para esa migración futura.

## Migración

`20260912050000_company_configuration_per_company`, aditiva:

1. **Asegura la compañía principal** con un `INSERT OR IGNORE` que la deriva de la propia fila de configuración. `asegurarEmpresaPrincipal()` hace eso mismo en tiempo de ejecución leyendo esa fila, pero ahora la fila **la referencia**: si la migración corriera antes de ese arranque, la clave foránea quedaría colgando y el primer `UPDATE` de la configuración fallaría.
2. Redefine `configuracion_empresa` con `empresaId` (default `'1'`, que es el valor que ya tenían todas las tablas), su índice único y la clave foránea.
3. Crea `cerrojo_correlativo`.

**Rollback**: la columna existente no se borra en ningún paso; revertir deja la fila de la compañía principal intacta.

## Verificación

**Suite** — `tests/configuracion-por-empresa.test.ts`, sobre base efímera:

- cada compañía tiene su propia configuración, y la segunda **no hereda** RUC ni credenciales SUNAT de la primera;
- editar una no toca a la otra;
- una compañía no puede tener dos configuraciones (el índice único lo impide de verdad);
- borrar una compañía con configuración se rechaza;
- **regresión del cerrojo**: con dos configuraciones creadas, los correlativos siguen generándose.

**Guardias estructurales** — el riesgo de este cambio no es que falle, es que alguien vuelva a escribir `where: { id: "1" }` y lea la configuración de la compañía principal desde otra, sin error de TypeScript ni de lint y sin nada visible en pantalla. Tres pruebas auditan el código fuente:

- ningún archivo de `src/` lee la configuración por la fila global,
- nadie llama al ayudante sin compañía,
- la firma no recupera un valor por defecto para `empresaId`,
- y en `critical-flows.test.ts`, que el cerrojo no vuelva a apoyarse en `configuracion_empresa`.

**Navegador** — `npm run dev:demo` con las dos compañías pobladas (`prisma/seed-segunda-empresa.ts` ahora siembra la configuración de la segunda con RUC, IGV y umbrales propios, deliberadamente distintos para que una cifra cruzada salte a la vista):

| | Compañía principal | Segunda compañía |
|---|---|---|
| Razón social | Grasas y Lubricantes del Perú S.A.C. | Lubricantes del Sur S.A.C. |
| RUC | 20123456789 | 20555444333 |
| Tasa de IGV | 18 % | 10 % |
| Ciudad | Lima, Perú | Arequipa, Perú |
| Compras a partir de | S/ 5000 | S/ 1111 |
| Tarifa mano de obra | 77 | 33 |

Recorrido ejecutado: la pantalla de configuración muestra los datos propios de cada compañía; el **membrete impreso** de la factura `F999-00000001` de la segunda compañía sale con *"Lubricantes del Sur S.A.C. — RUC 20555444333"*, que antes de este cambio habría llevado el RUC de la primera; crear un cliente desde la segunda compañía genera su correlativo (`CLI-00001`) sin error; y guardar la configuración de la primera (tarifa 77) deja la de la segunda intacta (tarifa 33).

## Lo que este cambio no hace

- **No separa las series de documento ni la numeración** entre compañías más de lo que ya estaban: `SerieDocumento` ya era por compañía y el cerrojo de correlativos es global a propósito.
- **No agrega los campos de entidad legal completa** a `Empresa` (`direccionFiscal`, `representanteLegal`, `regimenTributario`): siguen en P2 del Blueprint 05.
- **No valida** que una compañía nueva tenga RUC o credenciales antes de emitir. Una compañía nueva empieza con la configuración por defecto y el proveedor OSE en `SIMULADO`, que es el estado seguro: nadie recibe CDR falsos por accidente. Configurarla es un paso explícito del alta, igual que el plan de cuentas o las series.
