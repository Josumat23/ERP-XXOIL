# Aislamiento multiempresa de Proyecciones/S&OP

Este bloque limita el ciclo trimestral de Proyecciones a la empresa activa. La lista, creación y edición de escenarios validan la compañía seleccionada y ya no dependen de la empresa predeterminada.

El cálculo usa exclusivamente presentaciones, ventas históricas, pedidos firmes, fórmulas, lotes, reservas de insumos, calendarios de planta, vendedores, caja, cuentas por cobrar y cuentas por pagar de esa empresa. Las entidades sin `empresaId` directo, como reservas y calendarios, se aíslan mediante sus relaciones obligatorias con el lote o almacén propietario.

El seed demostrativo conserva explícitamente la empresa `1`; esta decisión solo corresponde al conjunto de datos inicial y no al flujo operativo de la aplicación.

## Verificación

- TypeScript sin errores.
- Lint, comprobación de formato/diff y compilación de producción.
- Auditoría estática de consultas del dominio para confirmar que cada lectura y mutación transporta `empresaId` o valida la relación propietaria.
