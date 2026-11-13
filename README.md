# EventOre Platform

Backend de trazabilidad mineral de XTRACTA: Identity, Traceability, API Gateway,
migraciones PostgreSQL, contratos API y pruebas. Requiere Node.js 24 y, para Compose,
Docker con Compose v2. El frontend Vue/Vite se desarrolla en
[XTRACTA-EventOre/eventore](https://github.com/XTRACTA-EventOre/eventore).

## Arranque recomendado

```sh
git clone https://github.com/XTRACTA-EventOre/eventore-platform.git
cd eventore-platform
git switch develop
# Mientras el PR de independencia esté abierto:
# git switch feature/independent-backend
cp .env.compose.example .env
# Editar .env: sustituir contraseñas y secreto interno; APP_BASE_URL es el origen del frontend.
docker compose up -d --build
docker compose ps
```

En PowerShell, usar `Copy-Item .env.compose.example .env`. Los dos jobs de migración
deben finalizar con código 0. La API está en `http://localhost:3000/api/v1/health`;
OpenAPI en `/api/v1/openapi.json` y Swagger en `/api/docs`. El gateway sirve solo APIs.

Para crear la primera cuenta, definir temporalmente `BOOTSTRAP_PASSWORD` con 12–128
caracteres y ejecutar:

```sh
docker compose exec -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js correo@ejemplo.com 11111111-1111-4111-8111-111111111111
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

Copiar `.env.example` a `.env`. Preparar dos bases PostgreSQL independientes. En cada
terminal definir `DATABASE_URL` para la base correspondiente y `PORT` para su servicio:

| Terminal | Configuración | Comandos |
| --- | --- | --- |
| Identity | DATABASE_URL de Identity, PORT=3001, INTERNAL_AUTH_SECRET, APP_BASE_URL | `npm run migrate:identity`, `npm run start:identity` |
| Traceability | DATABASE_URL de Traceability, PORT=3002, IDENTITY_URL=http://localhost:3001, mismo secreto y origen | `npm run migrate:traceability`, `npm run start:traceability` |
| Gateway | PORT=3000, IDENTITY_URL=http://localhost:3001, TRACEABILITY_URL=http://localhost:3002, APP_BASE_URL | `npm run dev` o `npm start` |

Las variables del terminal prevalecen sobre `.env`. El comando `migrate` y `src/server.js`
se conservan como compatibilidad/regresión del Sprint 1 con una base única; el despliegue
normal usa los puntos de arranque y migraciones por servicio.

## Verificación y colaboración

`npm test` ejecuta Jest; las pruebas PostgreSQL requieren `TEST_DATABASE_URL` de una base
desechable terminada en `_test`. Sin esa variable se omiten esas pruebas. CI ejecuta la
regresión con PostgreSQL y un segundo workflow construye Compose, aplica migraciones,
crea una cuenta temporal y prueba login, registro, consulta, QR y revocación.
Para repetir ese recorrido: definir `API_BASE_URL` (gateway) y `SMOKE_PASSWORD` y ejecutar
`npm run smoke` sobre una instalación de prueba que tenga `smoke@example.test` provisionado.

Trabajar en `feature/*` desde `develop` y abrir PR hacia `develop`; no hacer push directo
a `main`. [Historial y separación](docs/repository-split.md),
[arquitectura y límites](docs/microservices.md),
[aceptación Sprint 1](docs/sprint1-completion.md),
[evidencias previas de Avance 3](docs/avance3-sprint2.md).
Esta separación no completa las historias funcionales pendientes de los Avances 3 y 4.
