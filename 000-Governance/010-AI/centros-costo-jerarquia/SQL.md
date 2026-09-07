# SQL — Jerarquía de centros de costo

`CentroCosto.parentId` es una FK auto-relacional opcional con `ON DELETE SET NULL`, `ON UPDATE CASCADE` e índice. Migración versionada: `20260907210000_cost_center_hierarchy`. No se aplicó a bases de desarrollo ni respaldos durante la implementación.
