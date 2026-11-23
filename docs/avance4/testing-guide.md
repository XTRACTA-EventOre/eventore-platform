# Prueba reproducible de Avance 4

## Preparación

Requisitos: Git, Node.js 24, Docker Desktop con contenedores Linux y Docker Compose. El repositorio frontend instala y compila independientemente. El backend necesita MySQL 8.4; Compose crea ocho instancias, volúmenes y credenciales separados. Reservar recursos suficientes para ejecutarlas simultáneamente; la propuesta cloud inicial es 8 GiB, pendiente de medición de capacidad.

Mientras los PR permanezcan abiertos, seleccionar `feature/sprint2-access-custody` en ambos repositorios. Después de fusionarlos, usar las revisiones de `develop` que contengan esos commits. No combinar un frontend nuevo con una API anterior sin verificar el contrato.

En PowerShell 7, desde `eventore-platform`:

```powershell
./scripts/setup-local.ps1 -AppBaseUrl http://localhost:5173
docker compose up -d --build
docker compose ps -a
Invoke-RestMethod http://localhost:3000/api/v1/health
```

Si ya existe `.env`, el script lo conserva. Agregar las variables faltantes comparando `.env.compose.example`, sin cambiar las contraseñas de volúmenes existentes. Ocho migradores deben terminar con código 0. Para una instalación nueva puede copiarse el ejemplo y reemplazar todos sus marcadores. Las contraseñas SQL usadas dentro de URL deben estar codificadas o ser seguras para URL; el generador usa valores hexadecimales.

En una segunda terminal, desde `eventore`:

```powershell
npm ci --ignore-scripts
Copy-Item .env.example .env
npm run dev
```

Abrir `http://localhost:5173`, manteniendo `localhost` en ambas configuraciones. `VITE_API_BASE_URL=/api` y `API_PROXY_TARGET=http://localhost:3000`. El backend usa `APP_BASE_URL` para CORS, comprobación de origen y QR. Nunca colocar credenciales en variables `VITE_*`.

## Cuentas por rol

Las cuentas no se generan al arrancar. Para una demostración aislada usar un tenant de prueba; sustituir los correos al usar datos propios. Una misma contraseña temporal solo corresponde a un ambiente desechable.

```powershell
$env:BOOTSTRAP_PASSWORD = Read-Host 'Contraseña temporal de 12 a 128 caracteres' -MaskInput
$tenantId = '11111111-1111-4111-8111-111111111111'
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js admin@example.test $tenantId Administrator
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js demo@example.test $tenantId Operator
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js operator@example.test $tenantId Operator
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js carrier@example.test $tenantId Transporter
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js carrier2@example.test $tenantId Transporter
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js plant@example.test $tenantId PlantOperator
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js jeweler@example.test $tenantId Jeweler
docker compose exec -T -e BOOTSTRAP_PASSWORD identity node scripts/create-user.js certifier@example.test $tenantId Certifier
Remove-Item Env:BOOTSTRAP_PASSWORD
```

Administrator gestiona roles; Supervisor registra, cancela y prepara entrega; Transporter acepta custodia; PlantOperator recibe y procesa; Jeweler administra inventario y solicita certificados; Certifier revisa evidencia y emite; Administrator revoca. Ningún rol autoriza acceso a otro tenant. El CLI `user:roles` permite recuperación administrativa auditada con acceso SQL, sin habilitar registro público de administradores.

## Recorrido funcional

1. Administrador: asignar Supervisor a operator. Registrar un lote con peso y evidencia declarada. Probar cancelación en un lote separado y comprobar el motivo en su historial. Preparar entrega para el lote operativo.
2. Transportista: abrir `/lots/:id`, aceptar custodia y registrar un checkpoint. Proponer relevo al segundo transportista; la custodia se mantiene hasta que este acepte.
3. Segundo transportista: aceptar relevo y reportar un incidente con 1–4 fotografías JPG/PNG de hasta 5 MB cada una. Un incidente bloqueante conserva cuarentena. Una diferencia de peso de al menos 10 % también crea restricción para revisión.
4. Planta: recibir bajo cuarentena con motivo, revisar y liberar expresamente cuando corresponda. Iniciar procesamiento, registrar análisis entre 0 y 100 %, purificar con peso neto y causa. Registrar merma técnica por separado. Una merma >5 % bloquea el cierre hasta revisión.
5. Planta: ensayar división/fusión sobre lotes separados; cada entrada y salida debe tener balance exacto y versiones actuales. Los padres quedan Consumed y la genealogía conserva todas las relaciones. Completar procesamiento exige análisis, etapa documentada y ausencia de restricciones.
6. Revisor: comprobar documentos de origen. Si existe una declaración geográfica, contrastarla contra un polígono autorizado con fuente identificada; un punto fuera o pendiente no puede aprobarse. Estar dentro no aprueba automáticamente la evidencia.
7. Joyería: recibir el lote Processed, consultar su categoría y existencias, declarar material externo y comprobar el bloqueo de mezcla. Crear joya con cantidades disponibles; una corrección conserva las dos composiciones y su motivo.
8. Joyería: solicitar certificado PendingReview. Revisor: consultar causas de inelegibilidad y autorizar solo evidencia favorable de toda la genealogía. Descargar PDF y abrir su QR público. Administrador: revocar con motivo y evidencia. El mismo enlace debe mostrar Revoked. Un cambio posterior de composición/evidencia produce ReviewRequired; una dependencia inaccesible produce UnableToVerify.
9. Dispositivos: vincular una balanza a un lote. Sin reportes aparece conexión sin confirmar. Registrar calibración y configurar el adaptador con la credencial mostrada una sola vez. Enviar reportes autenticados según OpenAPI; batería <15 % alerta y >15 % recupera. Cinco minutos sin comunicación genera alerta. Desactivar con motivo y aceptación del impacto rechaza futuras mediciones y conserva las anteriores. La suite prueba reportes API, no hardware físico.
10. Reportes: consultar estados centrales, su fecha de actualización y merma ponderada. Las capturas aún locales no figuran como hechos aceptados. Exportar CSV por periodo; periodos mayores a 365 días se procesan como trabajo diferido autorizado. El archivo incluye fuentes y revisión; no acredita cumplimiento ESG.

## Captura offline y navegador

Para probar recarga offline usar build/preview, con `APP_BASE_URL=http://localhost:4173` en la plataforma y recrear sus servicios. La primera visita e inicio de sesión requieren conexión. Después:

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Desconectar la red desde DevTools, capturar, recargar y recuperar conexión. La captura conserva su UUID y solo pasa a aceptada con confirmación. La ubicación opcional se conserva como declaración pendiente.

Para automatizar, usar una instalación desechable con las cuentas anteriores, definir temporalmente `BOOTSTRAP_PASSWORD` y ejecutar desde frontend `npx playwright install chromium`, `npm run build` y `npm run test:e2e`. Playwright inicia el preview; el backend se inicia aparte. No ejecutar la suite contra datos de producción: crea, corrige y revoca registros de prueba.

## Verificación técnica y diagnóstico

Backend: `npm ci --ignore-scripts` y `npm test`. Sin `TEST_DATABASE_URL`, Jest omite las suites que requieren MySQL; esto no sustituye la validación completa. La URL de prueba debe terminar en `_test` y el usuario de pruebas necesita CREATE/DROP DATABASE para bases efímeras. CI ejecuta la suite con MySQL 8.4 y verifica dos aplicaciones sucesivas de migraciones. No usar credenciales de pruebas sobre una instalación real.

Frontend: `npm test` y `npm run build`. Swagger: `http://localhost:5173/api/docs`; el proxy mantiene el origen de sesión permitido. Los 66 contratos de negocio están en `docs/openapi.json`; no incluyen endpoints internos de confianza como API pública.

Si falla login, revisar cuenta, origen y contraseña; tres intentos fallidos bloquean quince minutos. Si aparece 403, comprobar rol/tenant y el hostname. Si aparece 409, volver a consultar versión, estado y restricciones. Ante 503 o pérdida de respuesta, conservar operationId y cuerpo; las pantallas ofrecen reintentos sin crear otra operación. Las confirmaciones entre servicios se reconcilian al consultar/reintentar, con ledgers locales y propietario Traceability. No se promete una transacción distribuida ni una entrega exactamente una vez.

`docker compose logs --tail=100` muestra diagnósticos; `docker compose down` conserva datos. `down --volumes` elimina datos y se reserva a CI desechable. Las migraciones anteriores conservan sus checksums; no se deben editar para actualizar instalaciones existentes.


## Colección Postman

Importar [avance4.postman_collection.json](../postman/avance4.postman_collection.json) en Postman. Definir `baseUrl` y `password` como variables de sesión privadas. La colección usa cuentas `admin-smoke`, `carrier-smoke`, `plant-smoke`, `jeweler-smoke` y `certifier-smoke` con los roles equivalentes, y crea/revoca datos de prueba. No exportar las variables privadas ni el cookie jar.

CI ejecuta sus 29 solicitudes con la imagen oficial Newman fijada por digest, en un contenedor efímero separado del producto. No instala ese runner en las dependencias del backend. La evidencia es el reporte JUnit y la salida real del workflow; no se presenta una captura inventada de la interfaz gráfica Postman. Las capturas Swagger muestran además interacción HTTP real desde el navegador.
