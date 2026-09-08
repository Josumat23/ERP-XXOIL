# Evaluación automática de proveedores

El tablero calcula un puntaje comparable de 0 a 100 usando calidad (40%), entrega (35%) y precio (25%). Si una dimensión no tiene datos, sus pesos se redistribuyen entre las disponibles.

- Calidad: porcentaje de inspecciones aprobadas.
- Entrega: resta cinco puntos por cada día promedio de retraso; entregas anticipadas no superan 100.
- Precio: resta dos puntos por cada punto porcentual de discrepancia promedio; documentos sin discrepancia cuentan como cero.
- Categorías: A ≥ 90, B ≥ 75, C ≥ 60 y D < 60.
- Confianza: baja con 1–2 muestras, media con 3–9 y alta desde 10.

Las consultas quedan aisladas por empresa activa. El plazo compara cada recepción únicamente con las líneas de insumo efectivamente recibidas.
