# Tablero versionado de Avance 4

Este tablero registra el estado real al preparar la revisión. Su historial está en Git; los enlaces llevan a los entregables verificables. La sesión no tiene `read:project`, por lo que no se presenta un GitHub Project creado o actualizado. No se reconstruye una cronología de tarjetas que no existió.

| Done integrado previamente | In review | To do Sprint 4 | Dependencia externa |
| --- | --- | --- | --- |
| Separación frontend/backend e historial; PR backend #1 y frontend #26 fusionados por el titular | Identity y permisos, Traceability y Logistics US02/05/18/19/23/24/25/26 | US01/03/04: cuenta, MFA y recuperación | Cuenta AWS y aprobación de gasto para ejecutar la infraestructura preparada |
| MySQL 8.4; backend #2 fusionado | Processing US27–32 | US06/34/38/39: integración ERP, claves, rotación y cuota | Revisión de PR backend #4 y frontend #27; no se fusionan automáticamente |
| Base Sprint 1 de captura offline/sincronización/QR | Jewelry US33/35/36/37/53 | US20/21/22: GPS, desvío y demora | Participación y revisión de cada integrante, verificable en Git; no atribuida sin evidencia |
| | Certification US40–44/51–52 | US48/49/50: suscripciones y facturación | Evidencia de hardware físico y uso real, distinta de reportes API de prueba |
| | Devices US07–11; geofence US13; Reporting US45–47 | Pruebas, documentación e integración de las 13 historias restantes para 226/226 SP | |
| | OpenAPI, BDD, CI y recorridos de navegador del incremento | | |

Backend: [PR #4](https://github.com/XTRACTA-EventOre/eventore-platform/pull/4). Frontend: [PR #27](https://github.com/XTRACTA-EventOre/eventore/pull/27). Cada grupo In review debe contrastarse con [criterios](acceptance-matrix.md), commits y runs antes de pasar a Done.

Las estimaciones originales de las tareas no son horas ejecutadas. Los commits nuevos registran su autoría efectiva; las responsabilidades previstas para compañeros no prueban que hayan implementado o revisado código.
