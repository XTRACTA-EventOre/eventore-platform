# Sprint 1: integración y aceptación

Alcance: US12 (registro), US14 (captura persistente), US15 (sincronización), US16 (idempotencia/conflicto), US17 (consulta QR).

## Puesta en marcha
La instalación vigente se describe en el [README](../README.md). Backend y frontend
se instalan y arrancan en repositorios independientes. Para la demo offline, compilar
Vue en eventore y ejecutar `npm run preview -- --host 0.0.0.0 --port 4173`; configurar
APP_BASE_URL=http://localhost:4173 en la plataforma. La SPA y su proxy sirven desde
4173, el gateway API desde 3000. El service worker se habilita en build, no en Vite dev.

No existe contraseña predeterminada. La primera visita y el primer inicio de sesión necesitan conexión. Después de cargar la aplicación, IndexedDB conserva capturas al recargar sin red. No borrar los datos del navegador mientras haya pendientes. En equipos compartidos, los datos locales permanecen en el perfil del navegador; cerrar sesión no borra capturas.

## Decisión de autenticación
El servidor valida una sesión opaca en cookie HttpOnly, SameSite=Strict, Secure en producción, con vencimiento a 8 horas. MySQL 8.4 almacena únicamente el hash del token; contraseñas con scrypt y salt aleatorio. Tres fallos bloquean la cuenta durante 15 minutos. Se rechazan escrituras de otro origen.
El tenant se obtiene de la sesión, nunca de un campo enviado por el navegador. La identidad local solo permite captura offline; cada envío vuelve a autorizarse en el servidor. Esto habilita Sprint 1; administración de usuarios, roles y un eventual JWT siguen siendo trabajo separado.

## Matriz de aceptación
| Historia | Implementación | Evidencia automatizada |
|---|---|---|
| US12 | Registro con peso positivo y evidencia PendingReview | RegisterLotApi, SessionFlow |
| US14 | IndexedDB + app shell offline; conserva UUID al recargar | IndexedDbPersistence, e2e/sprint1 |
| US15 | Sincronización automática al entrar/reconectar; backoff; solo confirma resultados del servidor | SyncRetry, e2e/sprint1 |
| US16 | Inbox/outbox transaccional, replay sin duplicar, conflicto visible | Idempotency, InboxOutbox, SessionFlow |
| US17 | PNG con enlace /lots/:id, consulta autenticada, estado cancelado | QrApi, e2e/sprint1 |

`npm test` en eventore-platform y `npm test` en eventore ejecutan las suites. Para incluir MySQL 8.4 definir TEST_DATABASE_URL apuntando exclusivamente a una base terminada en _test. Sin esa variable las pruebas de BD se omiten: no equivale a aceptación completa.
El workflow Backend regression ejecuta Jest con MySQL 8.4 y aplica migraciones dos
veces. Microservices acceptance comprueba Compose. La prueba Chromium con desconexión
real vive en el [frontend](https://github.com/XTRACTA-EventOre/eventore), cuyo workflow
obtiene una revisión explícita de la plataforma para la aceptación integrada. Los
archivos .feature describen escenarios; la ejecución usa Jest/Vitest/Playwright.

## Demostración
Iniciar sesión, desconectar red, capturar un lote, recargar, observar Pending, reconectar, observar Accepted, abrir Ver lote y escanear QR. Reenviar el mismo evento debe devolver AlreadyProcessed sin duplicar; cambiar su peso conservando UUID debe devolver Conflict. Otra organización debe recibir 404.

## Límites del incremento
La evidencia se registra, no se verifica automáticamente. El QR identifica un registro, no prueba autenticidad física ni origen ético. Los conflictos se muestran y conservan; su resolución administrativa y la cancelación por UI quedan fuera de estas cinco historias. El outbox se guarda transaccionalmente; consumidores de otros contextos pertenecen a siguientes incrementos.
Se retiró código ofuscado de los puntos de arranque backend/api.js y frontend/vite.config.js; no se ejecutó ese código durante esta integración.
