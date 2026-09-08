# API — Neteo de demanda MRP

`calcularOperaciones(detalles, anio, trimestre, empresaId)` consulta líneas de pedidos `PENDIENTE`/`PARCIAL`, calcula su saldo no facturado y devuelve `demandaNeteada` junto con la explosión de materiales. `calcularDemandaPlanificada` y `calcularUnidadesAProducir` son funciones puras testeables.
