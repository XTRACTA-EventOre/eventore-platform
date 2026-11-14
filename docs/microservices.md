# Arquitectura ejecutable de EventOre

La SPA Vue/Vite reside en [eventore](https://github.com/XTRACTA-EventOre/eventore); APIs, infraestructura y pruebas backend en eventore-platform. El incremento usa nueve procesos Node/Express (gateway más ocho servicios) y ocho MySQL 8.4, cada uno con usuario, migración y volumen propios. No hay joins SQL entre bases de servicios. Compose publica únicamente el gateway en loopback; la variante cloud agrega el servidor web.

| Servicio | Propiedad de datos | Integración |
| --- | --- | --- |
| Identity | Usuarios, hash de contraseña, sesiones, roles y auditoría de permisos | Cookie opaca HttpOnly; consulta remota de sesión y permisos vigentes por operación |
| Traceability | Lote y versión autoritativos, origen, restricciones, entregas, genealogía, hechos de transformación y geocerca; Inbox/Outbox | Comandos internos autorizados por actor; lecturas de evidencia para Certification/Reporting |
| Logistics | Ledger de custodia y comandos de viaje, eventos confirmados y fotografías privadas | HTTP a Traceability; la transición de lote y restricciones se consolida en su propietario |
| Processing | Ledger, proyección local de lotes y eventos de planta | HTTP al propietario del agregado para dividir/fusionar con balance y parentesco atómicos |
| Jewelry | Inventario, stock exacto, productos, composiciones e historial de correcciones | Recibo idempotente desde Traceability; stock/composición en transacción local |
| Certification | Solicitudes, decisiones, versión/hash de evidencia, auditoría, trabajos PDF | Consulta por HTTP Jewelry y toda la genealogía de Traceability; estado público falla de forma segura |
| Devices | Registro/vinculación, hash de credencial propia, calibraciones, lecturas y alertas/historial | Valida lote por HTTP. Reportes Bearer por dispositivo; evaluador periódico de disponibilidad |
| Reporting | Snapshots de reportes y trabajos/exportaciones autorizadas | Contrato de lectura consistente de Traceability; no lee su base directamente |
| Gateway | Sin almacenamiento de negocio | Rutas, proxy de archivos/cookies y CORS de origen explícito |

## Decisiones y límites de la extracción

Se aplica una extracción gradual con APIs por contexto y propiedad separada de datos. El agregado de trazabilidad y su versión continúan centralizados en Traceability para conservar balance, consumo único y genealogía bajo una transacción MySQL. Processing y Logistics poseen ledgers/proyecciones independientes y coordinan por HTTP. Esta decisión reduce el riesgo de doble consumo, a cambio de acoplamiento de disponibilidad al propietario; no se afirma una autonomía completa de sus modelos de dominio.

Los ledgers conservan comandos e identificadores ante respuesta perdida. El efecto del lote se consolida una vez en Traceability; confirmar la proyección local puede ocurrir después. Lecturas y reintentos reconcilian resultados confirmados. No existe una transacción distribuida ni un broker implementado. Outbox conserva los registros de captura, pero no hay un publicador general RabbitMQ. Su publicación/consumo futuro debe añadir pruebas de entrega y recuperación.

Cada operación protegida consulta Identity para permisos actuales; una indisponibilidad devuelve error y no autoriza por defecto. Los contratos internos requieren un secreto de servicio y los comandos requieren además sesión del actor. Las lecturas internas de Certification/Reporting aceptan un tenant declarado solo por servidor autenticado. El gateway descarta cabeceras internas enviadas por clientes. La red de Docker no publica servicios internos. El secreto compartido es una limitación: producción debe evolucionar a identidades por servicio, permisos mínimos y canales autenticados.

La consulta pública es una lista blanca. Una emisión Issued se vuelve a contrastar con composición y evidencia actuales; cambios exigen ReviewRequired y falta de confirmación produce UnableToVerify. Revoked siempre prevalece. QR y PDF no prueban autenticidad física ni cumplimiento legal/ESG.

## Documentación y ejecución

[Guía de arranque/pruebas](avance4/testing-guide.md), [66 contratos OpenAPI](openapi.json), [alcance de 169/226 SP](avance4/scope.md), [criterios](avance4/acceptance-matrix.md), [tablero real de revisión](avance4/kanban.md) y [preparación AWS](../infra/cloud/AWS.md).

Las figuras y fuentes se encuentran en [architecture](architecture/). Los diagramas cloud describen una configuración propuesta verificable, no un despliegue público existente. GitHub Actions sí construye y ejecuta los procesos y MySQL mediante Compose. El acceso a cuenta AWS y la aprobación de recursos facturables quedan fuera de esa ejecución.

Para bases PostgreSQL anteriores, no se afirma una conversión de datos ejecutada: conservar backups y seguir [mysql.md](mysql.md). Las migraciones MySQL existentes conservan sus checksums y se agregan migraciones nuevas. El historial y las ramas originales se conservan según [repository-split.md](repository-split.md).
