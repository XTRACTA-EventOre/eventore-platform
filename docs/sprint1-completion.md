# Sprint 1: integración y aceptación

Alcance: US12 (registro), US14 (captura persistente), US15 (sincronización), US16 (idempotencia/conflicto), US17 (consulta QR).

## Puesta en marcha
Requisitos: Node 24, PostgreSQL 16 o posterior.
1. Instalar: `npm ci --ignore-scripts --prefix backend` y `npm ci --ignore-scripts --prefix frontend`.
2. Crear una base vacía y copiar `backend/.env.example` a `backend/.env`. Configurar DATABASE_URL con sus credenciales.
3. Desde backend ejecutar `npm run migrate`. Las migraciones son transaccionales y se registran; repetir el comando no borra datos.
4. Si la base YA contiene las tablas originales de Sprint 1, respaldarla y usar una sola vez `npm run migrate -- --baseline-sprint1`. Este modo presupone que las dos migraciones originales fueron aplicadas sin cambios.
5. Provisionar cuenta desde backend: definir temporalmente BOOTSTRAP_PASSWORD con 12–128 caracteres y ejecutar `npm run user:create -- correo@ejemplo.com 11111111-1111-4111-8111-111111111111`. El UUID es la organización. El comando no modifica cuentas existentes. Eliminar después la variable del terminal.
6. Desarrollo: `npm run dev` en backend y frontend; APP_BASE_URL=http://localhost:5173.
7. Demo offline: `npm run build --prefix frontend`, APP_BASE_URL=http://localhost:3000 en backend/.env, luego `npm start` desde backend. Abrir http://localhost:3000. El service worker se habilita en el build, no en Vite dev.
8. Producción: origen HTTPS, NODE_ENV=production, APP_BASE_URL igual al origen público. El QR necesita una URL accesible desde el dispositivo lector (localhost solo sirve en el mismo equipo).

No existe contraseña predeterminada. La primera visita y el primer inicio de sesión necesitan conexión. Después de cargar la aplicación, IndexedDB conserva capturas al recargar sin red. No borrar los datos del navegador mientras haya pendientes. En equipos compartidos, los datos locales permanecen en el perfil del navegador; cerrar sesión no borra capturas.

## Decisión de autenticación
El servidor valida una sesión opaca en cookie HttpOnly, SameSite=Strict, Secure en producción, con vencimiento a 8 horas. PostgreSQL almacena únicamente el hash del token; contraseñas con scrypt y salt aleatorio. Tres fallos bloquean la cuenta durante 15 minutos. Se rechazan escrituras de otro origen.
El tenant se obtiene de la sesión, nunca de un campo enviado por el navegador. La identidad local solo permite captura offline; cada envío vuelve a autorizarse en el servidor. Esto habilita Sprint 1; administración de usuarios, roles y un eventual JWT siguen siendo trabajo separado.

## Matriz de aceptación
| Historia | Implementación | Evidencia automatizada |
|---|---|---|
| US12 | Registro con peso positivo y evidencia PendingReview | RegisterLotApi, SessionFlow |
| US14 | IndexedDB + app shell offline; conserva UUID al recargar | IndexedDbPersistence, e2e/sprint1 |
| US15 | Sincronización automática al entrar/reconectar; backoff; solo confirma resultados del servidor | SyncRetry, e2e/sprint1 |
| US16 | Inbox/outbox transaccional, replay sin duplicar, conflicto visible | Idempotency, InboxOutbox, SessionFlow |
| US17 | PNG con enlace /lots/:id, consulta autenticada, estado cancelado | QrApi, e2e/sprint1 |

`npm test --prefix backend` y `npm test --prefix frontend` ejecutan las suites. Para incluir PostgreSQL definir TEST_DATABASE_URL apuntando exclusivamente a una base terminada en _test. Sin esa variable las pruebas de BD se omiten: no equivale a aceptación completa.
El workflow .github/workflows/sprint1.yml instala dependencias, ejecuta ambas suites con PostgreSQL, compila, aplica migraciones dos veces y ejecuta Chromium con desconexión real. Conserva trazas si falla. Los archivos .feature describen escenarios; la ejecución usa Jest/Vitest/Playwright, no Cucumber.

## Demostración
Iniciar sesión, desconectar red, capturar un lote, recargar, observar Pending, reconectar, observar Accepted, abrir Ver lote y escanear QR. Reenviar el mismo evento debe devolver AlreadyProcessed sin duplicar; cambiar su peso conservando UUID debe devolver Conflict. Otra organización debe recibir 404.

## Límites del incremento
La evidencia se registra, no se verifica automáticamente. El QR identifica un registro, no prueba autenticidad física ni origen ético. Los conflictos se muestran y conservan; su resolución administrativa y la cancelación por UI quedan fuera de estas cinco historias. El outbox se guarda transaccionalmente; consumidores de otros contextos pertenecen a siguientes incrementos.
Se retiró código ofuscado de los puntos de arranque backend/api.js y frontend/vite.config.js; no se ejecutó ese código durante esta integración.
