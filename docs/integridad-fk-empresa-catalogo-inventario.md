# Integridad FK de empresa: catálogo e inventario

Esta primera etapa del ítem 0.2 convierte `empresaId` en una relación física con `Empresa` para el núcleo de identidad, catálogo e inventario:

- usuarios y auditoría de maestros;
- cuentas bancarias de empresa;
- categorías, productos, presentaciones, proveedores e insumos;
- movimientos de envases, movimientos kardex y conteos de inventario.

Las relaciones usan `onDelete: Restrict`: una compañía con historia operativa no puede eliminarse dejando registros huérfanos. La migración conserva las columnas, valores, índices y claves existentes; SQLite reconstruye únicamente las once tablas necesarias para incorporar las restricciones.

El seed asegura primero la empresa histórica `1` antes de crear registros dependientes. La suite aplica todas las migraciones sobre una base efímera y prueba que Prisma rechaza una categoría vinculada a una compañía inexistente.

El ítem 0.2 sigue abierto: los restantes dominios transaccionales se incorporarán en etapas independientes para mantener migraciones revisables y reversibles.
