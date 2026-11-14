# Despliegue cloud revisable

La configuración permite ejecutar el incremento en una VM existente aprobada, con Docker y Compose, DNS propio y puertos 80/443. Caddy entrega la SPA y el proxy `/api` bajo HTTPS; Identity usa cookie Secure. Los ocho MySQL conservan volúmenes y usuarios separados. El puerto 3000 del gateway queda ligado a loopback en la VM. Las bases no publican puertos.

La configuración se entrega para revisión. No se han creado cuentas, servidores ni cargos cloud, ni se afirma un despliegue público ejecutado. La validación efectiva disponible es Docker Compose en GitHub Actions.

## Aplicación sobre un servidor autorizado

Dimensionamiento inicial propuesto: Linux x86_64, 8 GiB RAM, 2 vCPU y 30 GiB de disco cifrado. Debe medirse con carga antes de asumir capacidad productiva. Una VM contiene varios procesos y bases independientes, pero sigue siendo un punto único de fallo. Los volúmenes y copias de seguridad requieren gestión operativa.

1. Aprobar proveedor, cuenta, región, presupuesto, VM y dominio. Si es AWS, una opción de diseño es EC2 con EBS cifrado y acceso administrativo mediante Session Manager, sin abrir SSH. No es una afirmación de disponibilidad o gratuidad en una cuenta concreta.
2. Instalar Docker/Compose mediante sus instrucciones oficiales. Configurar DNS hacia la VM y permitir solo HTTP/HTTPS de entrada. No abrir MySQL ni los puertos internos Node.
3. Clonar este repositorio y seleccionar el commit de backend revisado. No desplegar desde una rama mutable sin registrar la revisión.
4. Definir `PUBLIC_HOST` con el dominio real y `FRONTEND_REF` con el SHA completo revisado de eventore. Ejecutar desde la raíz `sh infra/cloud/bootstrap.sh`.
5. Provisionar las cuentas del tenant mediante el CLI de Identity, manteniendo la contraseña en una variable temporal. Comprobar login, QR, cookie Secure, rechazo de otro tenant y vigencia pública.
6. Verificar backups/restauración y supervisión del disco, memoria, procesos y certificados antes de usar datos reales. No usar `down --volumes` para actualizar.

El bootstrap crea `.env` una sola vez, sin imprimir secretos ni sobrescribir credenciales existentes. La compilación del frontend obtiene exclusivamente el commit público indicado. Un despliegue nuevo construye imágenes; no ejecuta modificaciones sobre `main`.

Fuentes: [instalación de Compose](https://docs.docker.com/compose/install/), [Session Manager en EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-systems-manager-session-manager.html), [HTTPS automático de Caddy](https://caddyserver.com/docs/automatic-https).
