# EventOre Platform

Backend de trazabilidad mineral de XTRACTA: ocho servicios, API Gateway,
migraciones MySQL 8.4, contratos API y pruebas. Requiere Node.js 24 y, para Compose,
Docker con Compose v2. El frontend Vue/Vite se desarrolla en
[XTRACTA-EventOre/eventore](https://github.com/XTRACTA-EventOre/eventore).

[Acceso corporativo, seguimiento GPS, integración ERP y suscripciones del Sprint 4](docs/sprint4.md)

## Arranque recomendado

```sh
git clone https://github.com/XTRACTA-EventOre/eventore-platform.git
cd eventore-platform
git switch feature/sprint2-access-custody
# Después de revisar e integrar el PR, usar develop.
cp .env.compose.example .env
# Editar .env: sustituir contraseñas y secreto interno; APP_BASE_URL es el origen del frontend.
docker compose up -d --build
docker compose ps
```

En PowerShell, usar `Copy-Item .env.compose.example .env`. Los ocho jobs de migración
deben finalizar con código 0. La API está en `http://localhost:3000/api/v1/health`;
OpenAPI en `/api/v1/openapi.json` y Swagger en `/api/docs`. El gateway sirve solo APIs.

Para crear la primera cuenta, definir temporalmente `BOOTSTRAP_PASSWORD` con 12–128
caracteres y ejecutar:

```sh
docker compose exec -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js correo@ejemplo.com 11111111-1111-4111-8111-111111111111 Administrator
```

Eliminar después la variable del terminal. No existe una contraseña predeterminada.
Arrancar el frontend en su propio repositorio con `npm ci --ignore-scripts` y `npm run dev`.
Su proxy `/api` apunta al gateway en el puerto 3000; `APP_BASE_URL=http://localhost:5173`
debe coincidir con el origen del navegador. Para preview offline, usar el puerto 4173
y cambiar `APP_BASE_URL` a `http://localhost:4173` antes de recrear servicios.

```sh
docker compose logs --tail=100
docker compose down
```

`down` conserva los volúmenes. No ejecutar `down --volumes` sobre datos que deban conservarse.

## Desarrollo con Node

```sh
npm ci --ignore-scripts
npm test
```

Copiar `.env.example` a `.env`. Preparar bases MySQL 8.4 independientes para Identity, Traceability, Logistics, Processing, Jewelry, Certification, Devices y Reporting. En cada
terminal definir `DATABASE_URL` para la base correspondiente y `PORT` para su servicio:

| Terminal | Configuración | Comandos |
| --- | --- | --- |
| Identity | DATABASE_URL de Identity, PORT=3001, INTERNAL_AUTH_SECRET, APP_BASE_URL | `npm run migrate:identity`, `npm run start:identity` |
| Traceability | DATABASE_URL de Traceability, PORT=3002, IDENTITY_URL=http://localhost:3001, mismo secreto y origen | `npm run migrate:traceability`, `npm run start:traceability` |
| Logistics | DATABASE_URL de Logistics, PORT=3003, IDENTITY_URL, TRACEABILITY_URL, mismo secreto y origen | `npm run migrate:logistics`, `npm run start:logistics` |
| Processing | DATABASE_URL propia, PORT=3004, IDENTITY_URL, TRACEABILITY_URL, secreto y origen | `npm run migrate:processing`, `npm run start:processing` |
| Jewelry | DATABASE_URL propia, PORT=3005, IDENTITY_URL, TRACEABILITY_URL, secreto y origen | `npm run migrate:jewelry`, `npm run start:jewelry` |
| Certification | DATABASE_URL propia, PORT=3006, IDENTITY_URL, TRACEABILITY_URL, JEWELRY_URL, secreto y origen | `npm run migrate:certification`, `npm run start:certification` |
| Devices | DATABASE_URL propia, PORT=3007, IDENTITY_URL, TRACEABILITY_URL, secreto y origen | `npm run migrate:devices`, `npm run start:devices` |
| Reporting | DATABASE_URL propia, PORT=3008, IDENTITY_URL, TRACEABILITY_URL, secreto y origen | `npm run migrate:reporting`, `npm run start:reporting` |
| Gateway | PORT=3000, IDENTITY_URL=http://localhost:3001, TRACEABILITY_URL=http://localhost:3002, LOGISTICS_URL=http://localhost:3003, PROCESSING_URL, JEWELRY_URL, CERTIFICATION_URL, DEVICES_URL, REPORTING_URL, APP_BASE_URL | `npm run dev` o `npm start` |

Las variables del terminal prevalecen sobre `.env`. El comando `migrate` y `src/server.js`
se conservan como compatibilidad/regresión del Sprint 1 con una base única; el despliegue
normal usa los puntos de arranque y migraciones por servicio.

## Verificación y colaboración

`npm test` ejecuta Jest; las pruebas MySQL 8.4 requieren `TEST_DATABASE_URL` de una base
desechable terminada en `_test`, con permisos CREATE/DROP DATABASE solo para pruebas. Sin esa variable se omiten esas pruebas. CI ejecuta la
regresión con MySQL 8.4 y un segundo workflow construye Compose, aplica migraciones,
crea cuentas temporales y prueba autenticación, registro, custodia y autorización. El workflow del frontend verifica además el recorrido hasta certificado, dispositivos, geocerca y reportes.
Para repetir ese recorrido: definir `API_BASE_URL` (gateway) y `SMOKE_PASSWORD` y ejecutar
`npm run smoke` sobre una instalación de prueba que tenga `smoke@example.test` provisionado.

Trabajar en `feature/*` desde `develop` y abrir PR hacia `develop`; no hacer push directo
a `main`. [Configuración MySQL y datos previos](docs/mysql.md),
[Historial y separación](docs/repository-split.md),
[arquitectura y límites](docs/microservices.md),
[aceptación Sprint 1](docs/sprint1-completion.md),
[evidencias previas de Avance 3](docs/avance3-sprint2.md).
El incremento funcional de Avance 4 se encuentra en el PR #4; revisar la matriz y el tablero antes de registrar historias como integradas.

Los volúmenes MySQL nuevos no reutilizan los de PostgreSQL. Este PR no traslada datos existentes: consultar [procedimiento y límites](docs/mysql.md).

Consulta [roles, cancelación y custodia](docs/sprint2-access-custody.md) para cuentas por rol, actualización de instalaciones y demostración.


## Avance 4 y prueba guiada

Para una instalación nueva con PowerShell 7, `./scripts/setup-local.ps1` genera las ocho contraseñas y el secreto en `.env` sin imprimirlos. El script conserva cualquier `.env` existente. Después ejecutar `docker compose up -d --build`. El gateway se publica en `127.0.0.1:3000`; las bases quedan dentro de Docker.

La [guía de demostración](docs/avance4/testing-guide.md) contiene cuentas por rol, arranque independiente, recorridos y diagnóstico. La [matriz de alcance](docs/avance4/scope.md) distingue 169/226 SP implementados para revisión (74,8 %) del cierre de integración. El [tablero versionado](docs/avance4/kanban.md) registra el estado de los PR sin inventar tareas terminadas. [Diseño y despliegue cloud revisable](infra/cloud/README.md).

La documentación Swagger se consulta en `http://localhost:5173/api/docs` mediante el proxy del frontend; sus llamadas protegidas comparten origen y cookie. En `http://localhost:3000/api/docs` puede leerse el contrato, pero las escrituras deben usar el origen permitido. Especificación agregada: `/api/v1/openapi.json`. Cada servicio publica su archivo en `/auth/openapi.json`, `/traceability/openapi.json`, `/custody/openapi.json`, `/processing/openapi.json`, `/jewelry/openapi.json`, `/certificates/openapi.json`, `/devices/openapi.json` y `/reporting/openapi.json` bajo `/api/v1`.
