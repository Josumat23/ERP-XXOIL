# La nota de débito por envío directo, y por qué XXOIL no debe ser OSE

## Lo que faltaba

De los cuatro documentos que el envío **directo** a SUNAT sabe mandar —factura, boleta, nota de crédito y guía de remisión— faltaba la **nota de débito**. Se podía emitir por un OSE, que arma el XML por su cuenta, pero no firmándola acá.

No era un descuido: estaba decidido a propósito, y el comentario lo decía. Construir el UBL de un documento tributario sin poder probarlo contra SUNAT —lo que exige el certificado digital real, que sigue pendiente— habría sido adivinar su estructura.

**Lo que cambió no es que ahora se pueda probar.** Cambió de dónde sale la estructura: del esquema UBL 2.1 y del ejemplo oficial de OASIS, no de la memoria. Son tres diferencias con la nota de crédito, y el esquema las exige:

| | factura y nota de crédito | nota de débito |
|---|---|---|
| raíz | `Invoice` / `CreditNote` | `DebitNote` |
| totales | `cac:LegalMonetaryTotal` | `cac:RequestedMonetaryTotal` |
| línea | `cac:InvoiceLine` / `cac:CreditNoteLine` | `cac:DebitNoteLine` |
| cantidad | `cbc:InvoicedQuantity` / `cbc:CreditedQuantity` | `cbc:DebitedQuantity` |

Sigue sin probarse contra SUNAT, y eso no lo arregla ningún código.

## Lo que apareció al escribirla

La nota de crédito reutilizaba la línea de la factura y le cambiaba el nombre así:

```ts
bloqueLineaFactura(...).replace(/InvoiceLine/g, "CreditNoteLine")
```

Eso renombra la etiqueta de afuera y deja `<cbc:InvoicedQuantity>` adentro. Y `cbc:InvoicedQuantity` **no es hijo válido de `cac:CreditNoteLine`** en UBL 2.1: esa línea lleva `cbc:CreditedQuantity`. El XML violaba el esquema, así que SUNAT lo habría rechazado en la validación.

Nadie lo había visto porque el envío directo espera el certificado digital y **nunca se mandó una nota de crédito de verdad**. Es el mismo patrón que viene apareciendo: lo que no se ejercita, no se verifica.

Ahora cada documento nombra su línea y su cantidad explícitamente, en vez de renombrar texto ya armado, y hay una prueba que falla si alguien vuelve a hacerlo.

> Esa prueba, en su primera versión, se puso en rojo **con el comentario que explica el defecto**, porque el comentario cita el `replace` que ya no existe. Se corrigió para mirar el código sin comentarios. Es el segundo caso en este repositorio; el otro está en `a-quienes-hay-que-avisar`.

## El catálogo 10 tiene cinco códigos, y solo tres aplican

| código | descripción | estado |
|---|---|---|
| 01 | Intereses por mora | emitido |
| 02 | Aumento en el valor | emitido |
| 03 | Penalidades / otros conceptos | emitido |
| 11 | Ajustes de operaciones de exportación | no se ofrece |
| 12 | Ajustes afectos al IVAP | no se ofrece |

El **12 no aplica al giro**: el IVAP grava la primera venta de arroz pilado —arroz descascarado y blanqueado en molino—. Una fábrica de grasas y lubricantes no lo emite nunca. Ofrecerlo sería poner en pantalla algo que solo se puede elegir mal.

El **11 espera algo anterior**. El negocio confirmó el 2026-09-21 que exportar está en los planes pero todavía no ocurre, y el sistema no sabe declarar un comprobante como operación de exportación: la factura no tiene el tipo de operación del catálogo 51 de SUNAT (`0200 Exportación de bienes`). Sin eso, una nota de débito con código 11 referiría a una factura que ante SUNAT no es de exportación. El código 11 entra cuando exista la facturación de exportación, no antes.

Lo que sí existe ya: el maestro de clientes admite documentos fiscales extranjeros (RUT, NIT, RFC, EIN, VAT) y país del cliente.

## Las tres vías, y cuál conviene

El sistema tiene arquitectura de adaptadores. La vía se elige en `Configuración → Empresa`, sin tocar código:

| vía | qué hace |
|---|---|
| `SIMULADO` | por omisión. No envía nada real; nadie recibe un CDR falso por accidente |
| `NUBEFACT` | un OSE/PSE comercial: se le manda el documento y él arma y envía |
| `SUNAT_DIRECTO` | arma el UBL, lo firma con el certificado y lo envía por SOAP |

### Ser OSE está descartado, y no por una limitación técnica

Un **Operador de Servicios Electrónicos** valida comprobantes **de terceros**. Para inscribirse en el registro de SUNAT hace falta, entre otras cosas:

- capital o activos netos por **S/ 1 650 000** o más;
- **carta fianza** según los requisitos de SUNAT;
- **informe de auditoría de seguridad de la información** firmado por un Lead Auditor ISO certificado;
- certificados digitales de uso **exclusivo** para el rol de OSE;
- aprobar el proceso de pruebas de SUNAT, y estar al día en las declaraciones.

Es montar una empresa de servicios, no facturar lo propio. Para un fabricante de grasas no tiene sentido.

### Lo que sí: dejarlo listo, que ya lo está

Contratar un OSE es **cambiar una configuración y cargar credenciales**. Lo único que falta —y falta para las dos vías, la directa y la del OSE— es el **certificado digital**, que es un trámite externo.

Sobre cuál elegir después: para una empresa del tamaño de XXOIL, un PSE/OSE contratado suele salir más barato que mantener la integración propia, porque cuando SUNAT cambia el estándar el proveedor se encarga. Pero como el camino directo ya está implementado, esa decisión se puede tomar con cotizaciones en la mano y sin reescribir nada.

## Fuentes

- [Registro de Operadores de Servicios Electrónicos — gob.pe](https://www.gob.pe/26870-solicitar-inscripcion-al-registro-de-operadores-de-servicios-electronicos-ose)
- [Impuesto a la Venta de Arroz Pilado — SUNAT](https://orientacion.sunat.gob.pe/01-concepto-y-operaciones-gravadas-ivap)
- [Guía XML Nota de Débito UBL 2.1 — SUNAT](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia+xml+nota%20de%20d%C3%A9bito+version%202-1+1+0_0_0%20(2).pdf)
- [UBL-DebitNote-2.1-Example.xml — OASIS](https://docs.oasis-open.org/ubl/os-UBL-2.1/xml/UBL-DebitNote-2.1-Example.xml)
- [cac:CreditNoteLine en UBL 2.1](http://www.datypic.com/sc/ubl21/e-cac_CreditNoteLine.html)
