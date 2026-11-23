# Sprint 2 — roles, cancelación y aceptación de custodia

Registro de una etapa previa. El alcance y las pruebas actuales se describen en la [guía de Avance 4](https://github.com/XTRACTA-EventOre/eventore-platform/blob/feature/sprint2-access-custody/docs/avance4/testing-guide.md); las limitaciones históricas de este documento no sustituyen ese estado vigente.


## Alcance verificable

US05 administra roles de usuarios de la misma organización y aplica los permisos
vigentes en cada petición. US18 cancela un Registered con motivo, actor y fecha.
US19 acepta una entrega preparada por un supervisor, registra transportista y pasa
el lote a InTransit. La ruta `/lots/:id` codificada en el QR abre la consulta y la
acción de custodia para el transportista. No se afirma captura mediante cámara.

| Rol | Operaciones |
| --- | --- |
| Administrator | Administrar roles, consultar/registrar/cancelar lotes y preparar entregas |
| Supervisor | Consultar/registrar/cancelar lotes y preparar entregas |
| Operator | Consultar y registrar/sincronizar lotes |
| Transporter | Consultar lotes y aceptar custodia |
| Viewer | Consultar lotes |

Se permiten combinaciones de roles. Un administrador no acepta custodia por su rol
administrativo: necesita también Transporter. Los roles son un catálogo versionado,
no permisos arbitrarios enviados por el cliente. No se permite quitar al último
administrador activo por API. Cada asignación queda en access_audit y una sesión ya
abierta obtiene los permisos nuevos sin requerir un nuevo login. Las APIs de módulos
todavía no implementados, como facturación, no se presentan como disponibles.

## Arranque y usuarios

Agregar `LOGISTICS_DB_PASSWORD` al `.env` existente, conservando las otras credenciales.
Las tres bases se ejecutan con usuarios y volúmenes propios. No borrar los volúmenes.

```sh
docker compose up -d --build
docker compose ps -a
```

Se aplican migraciones adicionales sobre MySQL conservando los archivos anteriores
y sus checksums. Los usuarios existentes reciben Operator si aún no tienen roles;
no se convierten automáticamente en administradores. Las tablas y los lotes existentes
se conservan. El cambio de restricción de estado puede reanudarse si se interrumpe.

Definir temporalmente BOOTSTRAP_PASSWORD (12–128 caracteres) y provisionar cuentas:

```sh
docker compose exec -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js admin@example.test 11111111-1111-4111-8111-111111111111 Administrator
docker compose exec -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js supervisor@example.test 11111111-1111-4111-8111-111111111111 Supervisor
docker compose exec -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js carrier@example.test 11111111-1111-4111-8111-111111111111 Transporter
```

Sin argumento de rol se usa Operator. Para promover una cuenta existente mediante
provisión controlada: `docker compose exec identity npm run user:roles -- correo tenant-uuid Administrator`.
Este comando requiere acceso directo al contenedor/base y audita system:provisioning;
es una vía administrativa de recuperación, no una API pública. Eliminar después la
variable BOOTSTRAP_PASSWORD del terminal. Nunca compartir credenciales de base con usuarios.

Arrancar el frontend separado. Un supervisor registra/consulta un lote, cancela otro
con motivo o prepara una entrega. Puede asignarla a un transportista específico o a
cualquiera autorizado de la misma organización. El transportista abre el enlace QR,
consulta la versión y acepta. Al recargar debe conservarse InTransit, el responsable
y el historial. Cancelar ese lote como registro inicial se rechaza.

## Propiedad y comunicación

Identity posee usuarios, sesiones, roles y auditoría de acceso. Traceability posee
el lote, versión, entregas, restricciones y eventos de ciclo de vida. Logistics posee
operaciones de custodia y su confirmación durable. Cada proceso usa exclusivamente
su base MySQL. El Gateway dirige `/auth` a Identity, `/lots` y `/events` a Traceability
y `/custody` a Logistics. Solo el Gateway publica puerto.

La aceptación usa una operación UUID estable. Logistics registra Pending y llama al
contrato HTTP interno de Traceability, conservando la cookie y un secreto de servicio.
Traceability vuelve a verificar identidad/permisos, serializa el lote con bloqueo y
comprueba versión, estado, restricciones y entrega vigente. Actualiza estado e historial
en una transacción local. Logistics guarda Accepted cuando valida la respuesta.
Una aceptación concurrente sobre la misma versión devuelve 409.

No hay una transacción atómica entre ambas bases. Si Traceability confirma y se pierde
la respuesta, Logistics permanece Pending. El reintento conserva UUID/cuerpo; la consulta
de custodia reconcilia el resultado mediante lectura HTTP interna de la operación ya
confirmada. No vuelve a ejecutar una aceptación sin autorización vigente. El navegador
conserva la operación pendiente por usuario/organización/lote hasta confirmarla.
La reconciliación ocurre por consulta/reintento; no hay todavía un reconciliador periódico.

Los contratos internos no se exponen por el Gateway. Se validan cookie y secreto; el
tenant y actor provienen de Identity. Un encabezado o cuerpo enviado por el navegador
no puede atribuir otra organización o transportista. El CORS permite PUT para administrar
roles solo desde el origen frontend configurado.

## Documentación y pruebas

OpenAPI agregado: `/api/v1/openapi.json` y `/api/docs` en Gateway. Archivos de contratos
por servicio: identity-openapi.json, traceability-openapi.json y logistics-openapi.json.
Los ejemplos del contrato son datos de muestra, no resultados de ejecución.

`tests/sprint2-access-custody.test.js` ejecuta servicios HTTP con tres bases distintas:
permisos revocados en la misma sesión, tenant, último administrador, cancelación/replay,
aceptación concurrente, restricciones, expiración, destinatario y respuesta perdida.
`tests/mysqlPersistence.test.js` verifica actualización desde el esquema MySQL previo,
conservación de usuarios/lotes y reanudación del cambio de CHECK. Los escenarios Gherkin
en tests/features se relacionan con esas pruebas; Jest ejecuta las implementaciones de
comportamiento y no se presenta como ejecución de Cucumber.

CI construye Compose y ejecuta smoke-microservices.js más smoke-sprint2.js. El segundo
usa cuentas temporales admin-smoke/carrier-smoke y modifica solo smoke@example.test
en el entorno de aceptación. No utilizar esas cuentas de CI en un entorno real.
La aceptación frontend prueba administración, cancelación e ingreso por el enlace QR.

## Trabajo que continúa para Avance 4

US23 incidentes/fotografías, US24 checkpoints, US25 relevo bilateral y US26 recepción
siguen pendientes de este bloque. lot_restrictions conserva y hace cumplir bloqueos,
pero su gestión por incidentes todavía no se ha implementado aquí. También permanecen
pendientes procesamiento, inventario, certificación y consulta pública del Sprint 3.
Los resultados reales deben consultarse en los checks de los PRs; no se atribuyen
funcionalidades futuras ni porcentajes del producto completo a estas pruebas.
