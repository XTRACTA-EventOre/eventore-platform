# Texto verificable para Avance 3: Sprint 2 y Capítulo V

Fuentes de planificación: [informe del equipo](https://docs.google.com/document/d/1qcsjouwkJjoxrh5jeC3HM2XAG_x1pxj-/edit) y [rúbrica](https://docs.google.com/spreadsheets/d/1OPFaIELK4sMlnQCOL8UV_ZVXMvff-mH1/edit). Fecha de corte: 12 de noviembre de 2026. Este texto refleja únicamente el estado observado en el repositorio y en las pruebas; actualizar resultados y enlaces del PR al cerrar la revisión.

## 5.3.2 Sprint 2: Product Implementation

El Sprint 2 planifica integrar el incremento de Sprint 1 y desarrollar inicio de sesión seguro, permisos, aceptación y delegación de custodia, checkpoints, recepción en planta, cancelación e incidentes. Las tareas ET21–ET41 del informe son un plan de trabajo, no un registro de tareas terminadas. En el código revisado ya existía una sesión opaca con cookie HttpOnly, bloqueo por intentos fallidos, registro y consulta de lotes, sincronización idempotente y QR. No se verificaron implementaciones de roles por operación y organización, logística, custodia, checkpoints, recepción ni incidentes.

La contribución de arquitectura de esta rama separa Identity y Extraction & Traceability en procesos y bases PostgreSQL independientes. Un gateway conserva las rutas públicas del frontend. La autorización de trazabilidad consulta a Identity mediante un contrato HTTP interno en cada petición protegida. Las migraciones se ejecutan por servicio; no hay consultas entre bases. [Diseño y guía de ejecución](microservices.md). Esta separación materializa parte de ET25 y ET29, pero no completa las historias funcionales del Sprint 2.

## 5.1 Testing Suites & General Patterns

Se añadieron pruebas de enrutamiento, cookie, QR binario y fallo cerrado de autenticación. En la verificación local de esta rama pasaron 76 pruebas backend y 17 frontend; cinco pruebas backend dependientes de PostgreSQL quedaron omitidas por ausencia de `TEST_DATABASE_URL`. La compilación del frontend pasó. El workflow de Compose prepara una prueba de aceptación de extremo a extremo en GitHub Actions. Su resultado debe registrarse después de la ejecución del PR; no se afirma aquí que haya pasado. Las pruebas actuales no validan todavía reglas de custodia, permisos por rol ni recepción.

## 5.3.2.6 Deployment Evidence for Sprint Review

El archivo `compose.yaml` define Identity, Traceability y Gateway como contenedores distintos y dos bases de datos con volúmenes separados. El Dockerfile construye el frontend y empaqueta el backend; cada contenedor inicia un proceso diferente. El gateway es el único servicio con puerto publicado. La disponibilidad local de Docker no permitió ejecutar Compose en el equipo de desarrollo. La evidencia de despliegue real deberá ser el resultado del workflow `Microservices acceptance`, `docker compose ps`, los logs y el recorrido de aceptación. No se ha verificado un despliegue en producción.

## 5.3.2.7 Team Collaboration y 5.3.2.8 Kanban

La rama feature y su PR permiten revisión del cambio. La asignación de responsabilidades y los estados de tablero que figuran en el informe son planificación; no se atribuyen contribuciones de código a otros integrantes sin commits o revisiones verificables. Vincular las tarjetas ET25 y ET29 al PR cuando el tablero exista. El resto debe mantener su estado real y sus evidencias propias.

## Pendiente para completar la rúbrica

Actualizar los diagramas C4 y los diagramas de datos según los contenedores desplegados; documentar contratos y ejemplos de cada nuevo servicio funcional; implementar y probar las historias del Sprint 2; ejecutar la aceptación con PostgreSQL y Compose; adjuntar resultados de CI, capturas de la demo, tablero y revisión del PR. La meta de endpoints funcionales de la rúbrica se calculará sobre el alcance acordado y probado, sin extrapolar los endpoints de Sprint 1 al producto completo.
