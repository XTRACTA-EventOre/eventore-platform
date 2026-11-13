# Separación desplegable de EventOre

## Alcance implementado

El incremento de Sprint 1 se ejecuta en tres procesos: `identity` (cuentas y sesiones), `traceability` (lotes, evidencias, eventos, inbox y outbox) y `gateway` (rutas públicas API). Compose construye las imágenes y ejecuta dos instancias PostgreSQL con volúmenes y credenciales diferentes. Solo el gateway publica un puerto. Cada servicio tiene su propio comando de arranque y puede reiniciarse por separado. El backend reside en eventore-platform y el frontend en [eventore](https://github.com/XTRACTA-EventOre/eventore). Cada contenedor es una unidad de despliegue.

| Contexto DDD | Datos que escribe | Contrato |
| --- | --- | --- |
| Identity | `app_users`, `app_sessions` | `/api/v1/auth/*`; `/internal/session` solo para trazabilidad |
| Extraction & Traceability | `mineral_lots`, `origin_evidence`, `trace_events`, `event_inbox`, `event_outbox` | `/api/v1/lots/*`, `/api/v1/events/*` |
| Gateway | Ninguno | Conserva las rutas API públicas; no sirve archivos Vue |

Trazabilidad no consulta tablas de Identity. En cada petición protegida consulta `/internal/session` con la cookie y un secreto de servicio; si Identity no responde, devuelve 503. El tenant se obtiene de la respuesta de Identity. El secreto no se envía al navegador. Esta integración HTTP síncrona es una dependencia de disponibilidad conocida; su sustitución por validación local de tokens o una caché con revocación requiere diseño y pruebas adicionales.

## Arranque local con Compose

1. Copiar `.env.compose.example` a `.env` y sustituir los tres valores de ejemplo por secretos propios. Las contraseñas de BD deben ser aptas para URL.
2. Ejecutar `docker compose up -d --build` desde la raíz. Los jobs `identity-migrate` y `traceability-migrate` aplican migraciones solo en sus respectivas bases.
3. Crear un usuario en el contenedor Identity: `docker compose exec -e BOOTSTRAP_PASSWORD=<contraseña-de-12-o-más-caracteres> identity node scripts/create-user.js correo@ejemplo.com <tenant-uuid>`. No usar una contraseña de demo en un entorno compartido.
4. Arrancar el frontend por separado con `npm run dev` en eventore y abrir `http://localhost:5173`. La API está en `http://localhost:3000/api/v1/health`. Revisar `docker compose ps` y `docker compose logs` ante fallos.

El QR usa `APP_BASE_URL`; para escanearlo desde otro dispositivo se necesita una URL accesible. En producción, el origen público debe usar HTTPS y el contenedor Identity debe recibir `NODE_ENV=production` para marcar la cookie `Secure`. La terminación TLS, gestión de secretos, copias de seguridad, observabilidad y políticas de red de producción siguen pendientes.

## Migración desde la base única

La configuración de Compose crea bases vacías. Para trasladar una instalación existente, detener escrituras, respaldar la base original y copiar por separado las tablas de Identity (`app_users`, `app_sessions`) y de Traceability (`mineral_lots`, `origin_evidence`, `trace_events`, `event_inbox`, `event_outbox`) a las bases nuevas. Conservar claves UUID y relaciones internas de cada grupo; no crear claves foráneas entre bases. Verificar recuentos y consultas por tenant antes de cambiar tráfico. El traslado de datos existentes no se automatiza en este PR y no se presenta como ejecutado.

## Verificación

`tests/microservices.test.js` comprueba rutas de gateway, conservación de cookie y QR binario, consulta de sesión remota y rechazo por falta de secreto. `.github/workflows/microservices.yml` arranca Compose y recorre inicio de sesión, registro, consulta, QR y revocación por el puerto público. Ejecutar además `npm test` en cada repositorio por separado. Las suites de PostgreSQL del Sprint 1 requieren `TEST_DATABASE_URL`; si no existe, Jest las omite.

## Límites actuales

Las capacidades de Logistics, Custody, Checkpoints, Incidents y Roles de Sprint 2 no están implementadas por esta separación. El gateway y los servicios tienen contratos REST para el alcance existente de Sprint 1; no se afirma cobertura del 75 % del producto completo. El outbox de Traceability persiste eventos, pero todavía no hay publicación ni consumidores de otros contextos.

Consulta el [README](../README.md) para arranque sin Compose y la [separación de repositorios](repository-split.md) para historial, API/CORS y orden de integración.
