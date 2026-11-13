# MySQL 8.4 — configuración vigente

La base de datos elegida para EventOre es **MySQL 8.4**, con InnoDB y el controlador
Node `mysql2/promise`. Identity y Traceability conservan bases, usuarios, procesos y
volúmenes separados; Gateway no accede a una base. Las rutas HTTP y el frontend Vue
se conservan. El cambio se prepara en `feature/mysql-database` y requiere revisión
mediante PR hacia `develop`.

## Arranque

Desde eventore-platform:

```sh
cp .env.compose.example .env
# Sustituir los marcadores de contraseña y secreto interno.
docker compose up -d --build
docker compose ps -a
curl http://localhost:3000/api/v1/health
```

En PowerShell usar `Copy-Item .env.compose.example .env`. Los contenedores MySQL deben
estar saludables y ambos jobs de migración terminar con código 0. Crear la cuenta
según el [README](../README.md). Arrancar Vue en el repositorio eventore con `npm ci
--ignore-scripts` y `npm run dev`; APP_BASE_URL=http://localhost:5173.

Los servicios SQL no publican puertos con Compose. Para desarrollo con Node y MySQL
local, crear las bases `identity` y `traceability` y usuarios con acceso solo a su
respectiva base. En cada terminal usar DATABASE_URL de la base correspondiente:
`mysql://identity:CONTRASENA@localhost:3306/identity` o
`mysql://traceability:CONTRASENA@localhost:3306/traceability`. Aplicar
`npm run migrate:identity` y `npm run migrate:traceability`, respectivamente.
Después iniciar servicios y gateway con los comandos del README. Escapar caracteres
especiales de contraseña mediante codificación URL. No publicar credenciales reales.

## Almacenamiento y migraciones

| Aspecto | Implementación |
| --- | --- |
| Identificadores | CHAR(36), ASCII y comparación binaria; se conservan UUID |
| Pesos | DECIMAL(65,30), hasta 35 dígitos enteros y 30 decimales; nunca Number de JavaScript |
| Fechas de eventos | DATETIME(6), normalizadas a UTC y con hasta seis decimales de segundo |
| Sesiones | Cookie HttpOnly; hash del token y vencimiento en MySQL; bloqueo tras tres fallos |
| Datos de eventos | JSON nativo, utf8mb4 y claves únicas por tenant/clientEventId |
| Transacciones | InnoDB; lote, evidencia, inbox y outbox se confirman o revierten juntos |
| Idempotencia concurrente | INSERT con clave única, manejo exclusivo de ER_DUP_ENTRY y lectura READ COMMITTED |
| Migraciones | GET_LOCK por base, registro y checksum SHA-256 por archivo |

Los pesos fuera del rango decimal se rechazan como INVALID_WEIGHT_PRECISION antes de
escribir, evitando redondeo silencioso. Las fechas fuera de 1000–9999 UTC o con más
de seis dígitos fraccionarios se rechazan como INVALID_TIMESTAMP. La consulta de peso
devuelve una cadena decimal exacta y elimina ceros fraccionarios de relleno; los JSON
de eventos conservan el texto de peso original para comparar reintentos.

MySQL hace commit implícito del DDL. Por ello, el runner no presenta un archivo entero
de migración como transaccional: ejecuta CREATE TABLE IF NOT EXISTS y registra el
checksum solamente al terminar el archivo. Un arranque interrumpido puede repetirse;
un archivo ya registrado con contenido diferente se rechaza. Las migraciones futuras
deben diseñarse con su recuperación explícita. No ejecutar DDL dentro de transacciones
de negocio. Se conserva `npm run migrate` para la regresión con una base única, pero
Compose aplica solo las migraciones del servicio correspondiente.

## Datos previos de PostgreSQL

Este cambio configura nuevas bases MySQL; no convierte datos de una instalación
existente. Los volúmenes nuevos son `identity-mysql-data` y `traceability-mysql-data`.
Los antiguos volúmenes PostgreSQL quedan conservados y no se reutilizan para MySQL.
No ejecutar `down --volumes` para hacer este cambio sobre datos que deban conservarse.

Si existe una instalación con datos: detener escrituras, respaldar PostgreSQL, crear
destinos MySQL vacíos, transformar UUID/JSON/fechas a UTC y verificar que cada peso
quepa exactamente en DECIMAL(65,30). Mantener separados los grupos Identity y
Traceability, conservar UUID, contraseñas hash y hashes de sesiones; comprobar claves,
recuentos y consultas por tenant, y probar login/QR/reintentos antes de cambiar tráfico.
No importar directamente un dump SQL de PostgreSQL. No se admite --baseline-sprint1
para simular una conversión. Mantener la instalación anterior como posibilidad de
retorno hasta validar el destino. La migración de datos reales no se ha ejecutado.

## Pruebas

`npm test` ejecuta la regresión. Para incluir MySQL, definir TEST_DATABASE_URL con una
base desechable cuyo nombre termine en `_test`; la cuenta de pruebas necesita CREATE
y DROP DATABASE para crear bases temporales aleatorias, que se eliminan al finalizar.
Esos permisos son solo del entorno de pruebas; los usuarios de cada servicio en Compose
no los necesitan. CI usa una cuenta temporal root en un contenedor aislado.

La suite comprueba sesiones y vencimiento, aislamiento por tenant, bloqueo y desbloqueo,
precisión decimal/UTC/JSON, reintentos simultáneos, rollback ante fallo del outbox,
migraciones repetidas y checksums. El smoke Compose recorre la API; la aceptación del
frontend se fija a una revisión MySQL para verificar captura offline y QR en Chromium.
La presencia de pruebas no equivale a un resultado: consultar los checks del PR.

Referencias de implementación: [mysql2 Promise Pool](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool),
[commit implícito del DDL en MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).
