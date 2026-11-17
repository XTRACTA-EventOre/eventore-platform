# AWS para la demostración académica

Se selecciona AWS, admitido por la guía de clase. El diseño usa EC2 con Docker Compose y ocho MySQL independientes; CloudFront proporciona una URL HTTPS propia de AWS y evita comprar un dominio para la demostración. La plantilla y los scripts son preparativos reproducibles. No existe aún una cuenta ni un despliegue AWS verificado de este proyecto.

## Recursos propuestos

- VPC, subred pública, ruta e Internet Gateway para una VM de demostración.
- EC2 `t3.large` con 2 vCPU, 8 GiB RAM, disco gp3 cifrado de 30 GiB, IMDSv2 y créditos CPU en modo standard.
- CloudFront con HTTPS de viewer y caché desactivada; reenvía cookies, origen, parámetros y cabeceras requeridas por las APIs.
- Origen EC2 HTTP accesible únicamente desde la lista administrada de CloudFront, más una cabecera privada generada en Secrets Manager. No se abren SSH, Node ni MySQL al público.
- Perfil de instancia para Session Manager y lectura exclusiva de ese secreto. Puede indicarse un perfil de laboratorio existente si sus permisos son adecuados.

El tramo CloudFront–EC2 usa HTTP y una cabecera privada; no se presenta como cifrado extremo a extremo. Para producción debe sustituirse por un origen privado y TLS autenticado. La VM única también exige backups, supervisión y una evolución de disponibilidad. El hecho de tener bases y procesos independientes no proporciona alta disponibilidad.

## Preparación sin crear infraestructura

Crear la cuenta AWS y completar su verificación es una acción del titular. Usar MFA y una sesión AWS CLI autorizada. No enviar contraseñas ni claves de acceso por chat. Antes de ejecutar recursos, confirmar región, créditos de la cuenta y presupuesto; una instancia t3.large no debe presumirse gratuita.

```powershell
./infra/cloud/prepare-aws.ps1 -Region us-east-1 -BackendRef <SHA-completo-revisado>
```

El script valida la plantilla con AWS, consulta la lista regional de CloudFront y prepara un change set con `--no-execute-changeset`. La ejecución del change set crea recursos facturables y debe aprobarse después de revisar la propuesta. No se ha ejecutado esta preparación contra una cuenta en la sesión actual.

Propuesta para aprobar: una demostración corta de hasta dos horas, verificar el cálculo en la cuenta y configurar una alerta de presupuesto antes de crear recursos. Una alerta AWS Budgets informa consumo con retraso y no constituye un límite automático de gasto. El costo incluye cómputo, almacenamiento, IPv4 pública, CloudFront, Secrets Manager y transferencias aplicables. Consultar precios en la región y condiciones de créditos, sin asumir descuentos.

## Publicación una vez autorizada la cuenta

1. Revisar y ejecutar el change set en CloudFormation. Esperar la creación y el fin de cloud-init en la instancia. La plantilla instala Docker y Compose v2.39.4 con comprobación SHA-256 y clona el commit de backend seleccionado.
2. Obtener de Outputs `InstanceId`, `PublicUrl` y `OriginSecretArn`. Conectar a la VM mediante Session Manager; no abrir el puerto 22.
3. Desde `/opt/eventore-platform`, definir `APP_BASE_URL` con `PublicUrl` y `FRONTEND_REF` con el commit completo revisado del frontend. Leer `ORIGIN_SECRET` desde Secrets Manager usando el rol de la instancia, sin imprimirlo:

```sh
export APP_BASE_URL=https://<distribution>.cloudfront.net
export FRONTEND_REF=<SHA-completo-revisado>
export ORIGIN_SECRET="$(aws secretsmanager get-secret-value --secret-id <OriginSecretArn> --query SecretString --output text)"
sh infra/cloud/bootstrap-aws.sh
unset ORIGIN_SECRET
```

4. Crear las cuentas de demostración por el CLI de Identity con contraseña temporal. Comprobar `/api/v1/health`, login, cookie Secure, aislamiento de tenant, QR público y descarga. Guardar URL, fecha, revisión, capturas y resultado de pruebas como evidencia del despliegue real.
5. Hacer backup y revisar recursos al finalizar. Eliminar el stack termina la instancia, pero conserva el disco de datos porque `DeleteOnTermination=false`; ese almacenamiento sigue generando cargos hasta que el titular apruebe retirarlo. Nunca retirar volúmenes sin validar la copia y la autorización de eliminación.

## Fuentes de implementación

[Guía EC2 Session Manager](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-systems-manager-session-manager.html), [MetadataOptions en CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-instance-metadataoptions.html), [instalación oficial de Compose](https://docs.docker.com/compose/install/linux/), [precios EC2 On-Demand](https://aws.amazon.com/ec2/pricing/on-demand/), [AWS Pricing Calculator](https://calculator.aws/).
