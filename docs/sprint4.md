# Sprint 4 de EventOre

Arranca ambos repositorios según sus README. Las migraciones de Identity, Logistics y Jewelry se aplican al levantar Compose. Para una instalación local nueva, scripts/setup-local.ps1 genera los secretos en .env. Para una instalación existente agrega BILLING_PROVIDER_SECRET con un valor aleatorio privado. Para probar el buzón y los pagos, agrega EVENTORE_DEMO_PROVIDERS=true. Activa REQUIRE_MFA=true si deseas exigir el segundo factor. Recrea identity tras cambiar estas variables. El modo de demostración usa un buzón privado dentro del contenedor y confirmaciones simuladas, sin cobros.

## Acceso corporativo

En «Registro de empresa y recuperación de acceso» registra razón social, RUC, referencia de evidencia, correo y contraseña. Guarda el ID. Tras verificar la empresa y al titular del correo, el responsable ejecuta:

```powershell
docker compose exec identity node scripts/review-company.js ID approve "Referencia de la verificación"
```

También admite reject. Para una solicitud de recuperación o segundo factor en demostración, consulta el código desde la consola de administración con `docker compose exec identity node scripts/demo-provider.js mail CORREO reset` o `login`. En producción configura ACCOUNT_MAIL_URL (HTTPS) y ACCOUNT_MAIL_SECRET para tu adaptador de correo, que debe aceptar POST autenticado con email, purpose, code y validMinutes.

## Viajes

Consulta un lote en tránsito, indica minutos y al menos dos coordenadas del corredor y pulsa «Autorizar captura GPS». El navegador necesita permiso de ubicación y HTTPS o localhost. Conserva abierta la aplicación. Cada diez minutos se guarda un punto con identificador propio. Al recuperar conexión se reenvían los puntos de la cuenta. Los desvíos superan 5 km y las demoras exceden el 120 % de la duración prevista. El historial conserva el reingreso y la recepción.

## Integración ERP

Desde Organización, la joyería genera o rota una clave. El ERP envía `GET /api/v1/jewelry/erp/lots/{lotId}` con `Authorization: Bearer CLAVE`. El lote debe estar en el inventario de la misma organización. El resultado contiene mineral, cantidad en gramos, estado, historial y último análisis. La solicitud 101 del minuto devuelve 429 con Retry-After.

## Suscripciones

El administrador solicita Pro desde Organización. En la demo, usa el ID de orden mostrado:

```powershell
docker compose exec identity node scripts/demo-provider.js payment ID Paid
```

Usa Rejected para probar un pago rechazado. El plan Pro de demostración cuesta S/ 49 y habilita el CSV de facturación. Un cambio a Base conserva el acceso hasta concluir el ciclo. El comprobante descargable es un registro de pago de EventOre. La integración externa recibe confirmaciones por POST /api/v1/auth/billing/confirmation con Bearer del proveedor y campos id, status, amountMinor, currency y reference. La demostración no conecta un adquirente comercial.
