param(
  [string]$Region = 'us-east-1',
  [string]$StackName = 'eventore-avance4',
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$BackendRef,
  [string]$ExistingInstanceProfileName = ''
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw 'Instala AWS CLI v2 e inicia sesión con un perfil autorizado. No pegues claves en el repositorio.' }
$account = aws sts get-caller-identity --region $Region --output json
if ($LASTEXITCODE -ne 0) { throw 'Falta una sesión AWS autorizada.' }
$prefixList = aws ec2 describe-managed-prefix-lists --region $Region --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing --query 'PrefixLists[0].PrefixListId' --output text
if ($LASTEXITCODE -ne 0 -or $prefixList -notmatch '^pl-[a-f0-9]+$') { throw 'No se pudo identificar la lista regional de CloudFront.' }
$template = Join-Path $PSScriptRoot 'aws-cloudformation.json'
aws cloudformation validate-template --region $Region --template-body "file://$template" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'AWS rechazó la validación de la plantilla.' }
$arguments = @('cloudformation','deploy','--region',$Region,'--stack-name',$StackName,'--template-file',$template,'--capabilities','CAPABILITY_IAM','--no-execute-changeset','--parameter-overrides',"BackendRef=$BackendRef","CloudFrontPrefixListId=$prefixList","ExistingInstanceProfileName=$ExistingInstanceProfileName")
& aws @arguments
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el change set. Revisar permisos de la cuenta o del laboratorio.' }
Write-Output 'Change set preparado sin ejecutarlo. Revisar recursos, permisos, presupuesto y retención de datos en CloudFormation antes de autorizar su ejecución.'
