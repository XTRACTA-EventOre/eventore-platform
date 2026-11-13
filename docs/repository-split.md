# Separación de repositorios — 13 de noviembre de 2026 (Lima)

## Propiedad

| Repositorio | Contenido y responsabilidad |
| --- | --- |
| [eventore](https://github.com/XTRACTA-EventOre/eventore) | Vue/Vite, IndexedDB, sincronización cliente, app shell offline, pruebas de unidad y navegador |
| [eventore-platform](https://github.com/XTRACTA-EventOre/eventore-platform) | Node/Express, Identity, Traceability, Gateway, SQL, Compose, contratos OpenAPI y pruebas backend |

Se inspeccionaron las 23 ramas del origen, scripts raíz y paquetes, workflows, imports,
pruebas, contratos y configuración. `develop` apuntaba a
`eec4cc8ee991f6d248684e88443acd5d73160214`, que ya integraba el PR #25 de servicios.
No había PRs abiertos al iniciar la separación. El monorepo no tenía imports de código
frontend/backend entre paquetes, pero Docker, los servidores estáticos y Playwright
dependían del árbol conjunto. Esas dependencias se sustituyen por HTTP y checkout de
una revisión fijada de la plataforma solo en la aceptación integrada del frontend.

## Historial y seguridad

El repositorio frontend conserva su remoto, commits y todas las ramas originales.
Se creó y verificó un bundle completo antes de los cambios. La extracción del backend
se hizo en una copia aislada con git-filter-repo 2.47.0, conservando `backend/` (movido
a raíz), `docs/`, workflows, README, gitignore, Compose y sus ejemplos/configuraciones.
Se excluyeron el código Vue y los paquetes orquestadores de la raíz del monorepo.

Se conservaron autores, fechas y relaciones de historial de los commits pertinentes;
los SHA cambian por la extracción. [Mapa de commits](migration/commit-map.txt) y
[mapa de las 23 ramas](migration/source-branches.json) permiten rastrear el origen.
La antigua `main` se preserva como `archive/source-main` en la plataforma, sin crear ni
actualizar una rama `main` durante esta migración. Las ramas históricas son referencia;
la configuración independiente nueva se propone en `feature/independent-backend`.
No se reescriben ni eliminan ramas del origen y no se utiliza push forzado.

Gitleaks 8.30.1 revisó todos los refs del origen antes de la publicación sin detectar
secretos. Los valores de CI son exclusivos de bases y cuentas temporales de prueba.
Los `.env` locales quedan ignorados; los ejemplos contienen marcadores.

Antes de retirar archivos del frontend se exige que el backend esté publicado y que
sus refs y blobs coincidan con la extracción local. La rama frontend se revisa mediante
PR hacia `develop`; los cambios de configuración backend tienen su propio PR.
Integrar primero el PR backend y después el frontend. No se fusionan PRs automáticamente.

## Contrato entre repositorios

La plataforma es la fuente de verdad de [OpenAPI](openapi.json) y del
[contrato Sprint 1](contracts/sprint1-api.md). Cambios de API requieren PR y verificar
al consumidor. Las rutas públicas `/api/v1/auth/*`, `/lots/*` y `/events/*` conservan
su prefijo `/api/v1`; `/lots/:id` es una ruta SPA propiedad del frontend.

`APP_BASE_URL` siempre identifica el origen público del frontend para QR y validación
de escrituras. `API_BASE_URL` identifica el gateway para el smoke test. El proxy de
Vite usa `API_PROXY_TARGET`; el navegador usa `VITE_API_BASE_URL=/api` por defecto.
El gateway acepta CORS con credenciales solo desde el origen exacto de `APP_BASE_URL`,
incluido preflight; rechaza otros orígenes. No se habilita un origen comodín.

La sesión HttpOnly conserva SameSite=Strict. Para producción, publicar SPA y `/api`
bajo el mismo origen con un reverse proxy, HTTPS y NODE_ENV=production en Identity.
La URL absoluta de API sirve para orígenes distintos del mismo sitio (por ejemplo,
puertos locales); dominios de sitios diferentes requieren otro diseño de cookies y
CSRF y no están soportados por esta configuración. Nunca enviar INTERNAL_AUTH_SECRET
al navegador ni ponerlo en una variable VITE_. No se migran datos existentes ni secretos
de GitHub. El acceso de equipos, reglas de protección y despliegues se administran por
repositorio; esta extracción no altera membresías ni configura producción.

## Alcance académico

La separación de repositorios prepara la evolución a microservicios; no acredita
historias de custodia, roles, checkpoints, incidentes ni el Avance 4 completo.
Las evidencias previas mantienen enlaces al monorepo y a sus runs originales.
Los nuevos PRs y sus checks acreditan únicamente la separación y su regresión.

## Decisión posterior de persistencia

La implementación vigente cambia de PostgreSQL a MySQL 8.4 mediante un PR específico. La extracción de historial anterior sigue reflejando el motor original. Consultar [MySQL](mysql.md) para configuración y datos previos; no se ha ejecutado una conversión de datos productivos.
