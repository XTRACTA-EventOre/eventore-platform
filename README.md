# EventOre

Proyecto universitario del equipo **XTRACTA** para una plataforma de trazabilidad mineral.

## Estado del proyecto

Repositorio inicial de colaboración. La implementación está pendiente; todavía no hay comandos para ejecutar el backend ni pruebas automatizadas.

## Stack previsto

- Frontend: Vue.js y JavaScript.
- Backend REST: Node.js y Express.js.
- Autenticación: JWT.
- Persistencia: PostgreSQL.
- Documentación de API: OpenAPI / Swagger.
- Pruebas previstas: Jest, Supertest y Postman.

Las versiones y las instrucciones de instalación se documentarán al incorporar la implementación.

## GitFlow

- `main`: versiones estables; rama principal del repositorio.
- `develop`: integración del trabajo del equipo.
- `feature/<descripcion>`: nace desde `develop` y se integra a `develop` mediante un pull request.
- `release/<version>`: nace desde `develop`; al publicar se integra a `main` y a `develop`, y se etiqueta la versión en `main`.
- `hotfix/<version>`: nace desde `main`; se integra a `main` y a `develop`.

### Empezar una funcionalidad

Sustituye `feature/mi-funcionalidad` por el nombre de la tarea asignada.

```bash
git clone https://github.com/XTRACTA-EventOre/eventore.git
cd eventore
git switch develop
git pull --ff-only origin develop
git switch -c feature/mi-funcionalidad
```

Después de editar los archivos, revisa lo que vas a subir:

```bash
git status
git add ruta/al/archivo
git diff --cached
git commit -m "feat: describe la funcionalidad implementada"
git push -u origin feature/mi-funcionalidad
```

En GitHub, abre un pull request con **base `develop`** y **compare `feature/mi-funcionalidad`**. Solicita una revisión a un compañero antes de integrarlo.

### Convenciones

Usar Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:` y `chore:`. Cada commit debe representar un cambio coherente. Las versiones seguirán Semantic Versioning (`MAJOR.MINOR.PATCH`).

No subir secretos, credenciales, archivos `.env` ni `node_modules`. El archivo `.env.example`, cuando se añada, debe contener únicamente valores de ejemplo.

## Incorporación del equipo

Las invitaciones de los tres compañeros quedan pendientes hasta contar con sus usuarios de GitHub. No hay invitaciones enviadas en esta inicialización.

La revisión de pull requests es una convención de trabajo; no implica que haya reglas automáticas de protección configuradas.
