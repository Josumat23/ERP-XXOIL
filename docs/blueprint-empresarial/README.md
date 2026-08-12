# Blueprint empresarial — auditoría fit/gap contra SAP S/4HANA

Auditoría del repositorio ERP-XXOIL para el objetivo declarado: fabricante y distribuidora peruana **grande** de grasas y lubricantes, varias plantas, almacenes, compañías, canales, alto volumen. Fecha de corte: 2026-08-06. SAP S/4HANA se usa como referencia de procesos, maestros y controles — no como complejidad a copiar sin justificación.

**Regla seguida en todo el conjunto**: cada afirmación cita ruta + símbolo/modelo + evidencia. Clasificación usada: verificado completo / parcial / solo UI / solo documentación / ausente / no aplicable justificado. Sin porcentajes inventados. Donde la documentación de gobernanza previa (`docs/gobernanza/`) había descartado un requisito por "no aplica por tamaño actual," este conjunto lo re-examina explícitamente contra la escala objetivo en vez de heredar la conclusión.

## Documentos

1. [01-inventario.md](01-inventario.md) — dominios, módulos, páginas, entidades (83 modelos), acciones, reportes.
2. [02-catalogo-procesos-l0-l4.md](02-catalogo-procesos-l0-l4.md) — catálogo de procesos L0-L4 de una fabricante de lubricantes.
3. [03-matriz-organizacion.md](03-matriz-organizacion.md) — sociedad, planta, almacén, compras, ventas, controlling, crédito, RR.HH. **Hallazgo central: no existe FK real hacia `Empresa` en el grafo transaccional.**
4. [04-fitgap-sap.md](04-fitgap-sap.md) — fit/gap por dominio (FI/CO, SD, MM, PP-PI, QM, PM, EWM, TM, PS, HCM, EHS, GRC, BI), con re-examen explícito de los descartes previos basados en tamaño.
5. [05-diccionario-campos-faltantes.md](05-diccionario-campos-faltantes.md) — campos/modelos faltantes por maestro y transacción, priorizados.
6. [06-integracion-end-to-end.md](06-integracion-end-to-end.md) — trazabilidad documento origen → inventario → calidad → costo → contabilidad → auditoría, por cadena (venta, compra, producción, activo fijo, proyecto, planilla).
7. [07-localizacion-peru.md](07-localizacion-peru.md) — CPE, GRE, SIRE, impuestos, planilla, SST, protección de datos. Contiene la lista de puntos que **requieren validación profesional**.
8. [08-auditoria-no-funcional.md](08-auditoria-no-funcional.md) — seguridad, arquitectura, concurrencia, testing, CI/CD, backup/DR. Incluye un hallazgo crítico de autorización de corrección inmediata.
9. [09-roadmap-oleadas.md](09-roadmap-oleadas.md) — oleadas con dependencias, criterios de aceptación, pruebas, rollback.
10. [10-preguntas-abiertas.md](10-preguntas-abiertas.md) — 24 preguntas de negocio/legales que el código no puede responder.
11. [11-actualizacion-sap-peru-ux-2026-08-12.md](11-actualizacion-sap-peru-ux-2026-08-12.md) — actualización contra SAP Business One, vigencia SIRE 2026 y patrón UX por maestro/transacción.

## Los 3 hallazgos más importantes

1. **Multi-empresa es cosmético fuera de Cliente/Proveedor** — `model Empresa` existe pero sin FK real desde el resto del grafo transaccional (`prisma/schema.prisma:2874-2888`, admitido en el propio comentario del esquema). Bloquea directamente el objetivo de "varias compañías."
2. **Envío de comprobantes electrónicos a SUNAT sin control de acceso** — `enviarComprobanteFactura`/`enviarComprobanteNotaCredito` no verifican sesión ni rol, a diferencia de cada otra función del mismo archivo. Corrección de una línea, prioridad inmediata (Blueprint 09, ítem 0.1).
3. **Ningún envío de facturación electrónica se ha probado nunca contra SUNAT real** — todo el código (UBL, firma XMLDSig, SOAP) está completo pero nunca ejecutado contra el ambiente beta/producción real; el sistema corre en modo `SIMULADO` por defecto.

## Estado

Auditoría completa. Sin implementación realizada — a la espera de aprobación antes de iniciar cualquier oleada del roadmap.
