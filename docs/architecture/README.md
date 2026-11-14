# Modelos del incremento

Las figuras PNG/SVG se generan desde `scripts/render-architecture.py` usando Pillow y una fuente Arial/DejaVu. Son visualizaciones del código actual, no capturas de una herramienta externa. La fuente C4 editable está en [workspace.dsl](workspace.dsl); puede abrirse en Structurizr. Los diagramas de datos se obtienen de las migraciones SQL y el inventario completo se conserva en [data-model.json](data-model.json). Los campos mostrados son un resumen; SQL conserva tipos, longitudes, índices y restricciones completos. `schema_migrations` es metadato común y se omite en las figuras.

- [Contexto](c4-context.png), [contenedores](c4-containers.png), [componentes y recuperación](c4-components.png).
- [Despliegue AWS propuesto](c4-aws-deployment.png): no afirma un despliegue cloud ejecutado.
- Datos: [Identity](data-identity.png), [Traceability](data-traceability.png), [Logistics](data-logistics.png), [Processing](data-processing.png), [Jewelry](data-jewelry.png), [Certification](data-certification.png), [Devices](data-devices.png), [Reporting](data-reporting.png).

El modelo anterior del informe, con PostgreSQL, broker propuesto y backend modular, corresponde a una etapa histórica de diseño. El incremento actual usa MySQL, comunicación HTTP y el agregado autoritativo de Traceability; no se presenta el broker ni la autonomía completa de modelos como implementados. Ver [decisiones y límites](../microservices.md).
