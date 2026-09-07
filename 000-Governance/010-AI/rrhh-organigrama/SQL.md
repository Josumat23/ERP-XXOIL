# SQL — Organigrama de RR. HH.

- `Empleado.jefeDirectoId`: FK autorreferente opcional con `ON DELETE SET NULL`.
- Índice sobre `jefeDirectoId` para recorrer reportes.
- Migración `20260907110000_employee_reporting_line`, sin backfill inventado.
