# Texto verificable para Avance 3: Sprint 2 y Capítulo V

Fuentes de planificación: [informe del equipo](https://docs.google.com/document/d/1qcsjouwkJjoxrh5jeC3HM2XAG_x1pxj-/edit), [guía y cronograma de entregables](https://docs.google.com/document/d/1QcjnmvQKywFScJD7_KZoCEX7KgB1_Aqm/edit) y [rúbrica](https://docs.google.com/spreadsheets/d/1OPFaIELK4sMlnQCOL8UV_ZVXMvff-mH1/edit). Fecha de corte: 12 de noviembre de 2026 (hora de Lima). Este texto refleja únicamente el estado observado en el repositorio y en las pruebas.

## 5.3.2 Sprint 2: Product Implementation

El Sprint 2 planifica integrar el incremento de Sprint 1 y desarrollar inicio de sesión seguro, permisos, aceptación y delegación de custodia, checkpoints, recepción en planta, cancelación e incidentes. Las tareas ET21–ET41 del informe son un plan de trabajo, no un registro de tareas terminadas. En el código revisado ya existía una sesión opaca con cookie HttpOnly, bloqueo por intentos fallidos, registro y consulta de lotes, sincronización idempotente y QR. No se verificaron implementaciones de roles por operación y organización, logística, custodia, checkpoints, recepción ni incidentes.

La contribución de arquitectura de esta rama separa Identity y Extraction & Traceability en procesos y bases PostgreSQL independientes. Un gateway conserva las rutas públicas del frontend. La autorización de trazabilidad consulta a Identity mediante un contrato HTTP interno en cada petición protegida. Las migraciones se ejecutan por servicio; no hay consultas entre bases. [Diseño y guía de ejecución](microservices.md). Esta separación materializa parte de ET25 y ET29, pero no completa las historias funcionales del Sprint 2.

## 5.3.2.2 Development Evidence for Sprint Review

La evidencia de código es el [PR #25](https://github.com/XTRACTA-EventOre/eventore/pull/25), creado desde `feature/microservices-avance3` hacia `develop`. Incluye los puntos de arranque independientes, Compose, migraciones por servicio, gateway y pruebas. El PR #25 fue integrado en develop antes de la separación de repositorios del 13 de noviembre; sus enlaces se conservan como evidencia histórica. No se registran como terminadas las historias US18, US19, US23–US26 ni US05.

## 5.1 Testing Suites & General Patterns

Se añadieron pruebas de enrutamiento, cookie, QR binario y fallo cerrado de autenticación. En la verificación local de esta rama pasaron 76 pruebas backend y 17 frontend; cinco pruebas backend dependientes de PostgreSQL quedaron omitidas por ausencia de `TEST_DATABASE_URL`. La compilación del frontend pasó. En CI pasaron [Microservices acceptance](https://github.com/XTRACTA-EventOre/eventore/actions/runs/43355749951), con dos bases PostgreSQL y el recorrido HTTP por el gateway, y [Sprint 1 acceptance](https://github.com/XTRACTA-EventOre/eventore/actions/runs/43355749854), que ejecutó las suites con PostgreSQL y el navegador. Las pruebas actuales no validan todavía reglas de custodia, permisos por rol ni recepción.

## 5.3.2.4 Execution Evidence for Sprint Review

El script `scripts/smoke-microservices.js` (antes `backend/scripts/smoke-microservices.js`) ejecutó en CI el inicio de sesión, registro y consulta de un lote, generación de QR y rechazo después de cerrar sesión. Este recorrido acredita el incremento funcional existente a través de los nuevos procesos. No acredita aún el recorrido de custodia, checkpoints, incidentes o recepción previsto para Sprint 2. Las capturas y el video de ese recorrido siguen pendientes.

## 5.3.2.5 Microservices Documentation Evidence for Sprint Review

`docs/microservices.md` identifica contextos, propiedad de tablas, contrato interno, arranque, verificación y límites. El OpenAPI previo documenta las rutas del incremento de Sprint 1 y se sirve por el gateway. Faltan contratos OpenAPI y ejemplos de solicitud y respuesta para los servicios funcionales de Logistics, Roles y el resto de Sprint 2; tampoco se acredita cobertura del 75 % del producto completo.

## 5.3.2.6 Deployment Evidence for Sprint Review

El archivo `compose.yaml` define Identity, Traceability y Gateway como contenedores distintos y dos bases de datos con volúmenes separados. El Dockerfile de ese PR construía el frontend y empaquetaba el backend; tras la separación, el Dockerfile de eventore-platform empaqueta únicamente el backend; cada contenedor inicia un proceso diferente. El gateway es el único servicio con puerto publicado. Docker no estuvo disponible en el equipo local, pero el [workflow de Compose](https://github.com/XTRACTA-EventOre/eventore/actions/runs/43355749951) terminó correctamente en GitHub Actions: construyó las imágenes, aplicó migraciones, creó un usuario de prueba y ejecutó el recorrido HTTP. Esta es evidencia de despliegue temporal de aceptación en CI, no de producción ni de migración de datos existentes.

## 5.3.2.7 Team Collaboration y 5.3.2.8 Kanban

La rama feature y su PR permiten revisión del cambio. La asignación de responsabilidades y los estados de tablero que figuran en el informe son planificación; no se atribuyen contribuciones de código a otros integrantes sin commits o revisiones verificables. Vincular las tarjetas ET25 y ET29 al PR cuando el tablero exista. El resto debe mantener su estado real y sus evidencias propias.

## Pendiente para completar la rúbrica

Actualizar los diagramas C4 y los diagramas de datos según los contenedores desplegados; documentar contratos y ejemplos de cada nuevo servicio funcional; implementar y probar las historias del Sprint 2; ejecutar la aceptación con PostgreSQL y Compose; adjuntar resultados de CI, capturas de la demo, tablero y revisión del PR. La meta de endpoints funcionales de la rúbrica se calculará sobre el alcance acordado y probado, sin extrapolar los endpoints de Sprint 1 al producto completo.

## Separación de repositorios posterior

La [separación del 13 de noviembre](repository-split.md) conserva estas evidencias históricas. Los nuevos workflows separan regresión backend y aceptación frontend; sus resultados se deben consultar en sus respectivos PRs. El Avance 4 funcional continúa pendiente.
