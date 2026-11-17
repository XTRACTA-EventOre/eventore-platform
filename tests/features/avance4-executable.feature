# language: es
Característica: Incremento acumulado verificable de EventOre

  @IAM @US02 @US05
  Escenario: IAM bloqueo y permisos vigentes
    Dado una cuenta activa de prueba con permisos de administrador
    Cuando se cambia el rol de otro usuario y se provocan tres accesos fallidos
    Entonces la siguiente operación usa los permisos nuevos y el acceso queda bloqueado temporalmente

  @Traceability @US12 @US14 @US15 @US16 @US17 @US18
  Escenario: TRACE captura estable y cancelación con historial
    Dado un evento capturado localmente con identidad estable
    Cuando el evento se sincroniza dos veces y luego se cancela el lote
    Entonces hay un solo lote y su QR previo consulta el estado cancelado

  @Logistics @US19 @US23 @US24 @US25 @US26
  Escenario: LOGISTICS relevo bilateral y cuarentena
    Dado un lote registrado con entrega disponible
    Cuando se acepta custodia y se registra una discrepancia crítica de peso
    Entonces la transferencia queda bloqueada y la recepción autorizada conserva la cuarentena

  @Processing @US27 @US28 @US29 @US30 @US31 @US32
  Escenario: PROCESSING balance y genealogía
    Dado un lote recibido e iniciado en planta
    Cuando se divide con balance exacto y se analiza y purifica una salida
    Entonces los padres quedan consumidos una vez y la salida puede finalizar su procesamiento

  @Jewelry @US33 @US35 @US36 @US37 @US53
  Escenario: JEWELRY inventario y corrección de composición
    Dado un lote procesado y un material externo declarado
    Cuando se recibe el lote y se intenta mezclarlo con material externo
    Entonces se rechaza la mezcla y una composición permitida conserva las versiones de su corrección

  @Certification @US40 @US41 @US42 @US43 @US44 @US51 @US52
  Escenario: CERTIFICATION emisión PDF y revocación pública
    Dado una joya con genealogía y evidencia revisadas
    Cuando se solicita y autoriza el certificado y se descarga su PDF
    Entonces la consulta pública confirma la emisión y después muestra su revocación

  @Devices @US07 @US08 @US09 @US10 @US11
  Escenario: DEVICES disponibilidad y medición autorizada
    Dado un dispositivo vinculado con calibración documentada
    Cuando reporta batería baja y después pierde comunicación cinco minutos
    Entonces se conservan alertas y recuperación y la desactivación rechaza nuevas mediciones

  @Traceability @US13
  Escenario: GEO concesión contrastada y fuente identificada
    Dado un polígono cuya autorización revisó un responsable
    Cuando una ubicación queda fuera del área declarada
    Entonces el origen no puede aprobarse y se conserva la discrepancia con su fuente

  @Reporting @US45 @US46 @US47
  Escenario: REPORTING consolidación y exportación autorizada
    Dado operaciones de planta con pesos y mermas documentados
    Cuando se consulta el tablero y el reporte ponderado y se exportan las evidencias
    Entonces se muestran solo hechos aceptados del tenant y el CSV no acredita cumplimiento ESG
