# Aislamiento multiempresa de productos y presentaciones

Los listados, detalles, navegación lateral y selectores de productos y presentaciones se filtran por la empresa activa.

Las acciones de alta, edición y activación vuelven a comprobar la compañía en el servidor. Un producto solo puede usar una categoría activa de su empresa; una presentación solo puede usar un producto y una ubicación de esa misma empresa. Los escalones de precio también validan la propiedad de la presentación antes de crearse o eliminarse.

El `empresaId` se escribe explícitamente en las altas, sin depender del valor por defecto histórico.
