# Aislamiento multiempresa de maestros comerciales

Clientes, vendedores y zonas se listan, consultan y modifican exclusivamente dentro de la empresa activa. Las altas escriben `empresaId` explícitamente y todas las acciones sensibles vuelven a comprobar la propiedad del registro en el servidor.

Un cliente solo puede relacionarse con una zona y un vendedor activos de su compañía. Un vendedor solo puede asignarse a una zona activa de esa misma compañía. Las navegaciones laterales y los selectores siguen las mismas reglas, y la auditoría conserva la compañía correspondiente.
