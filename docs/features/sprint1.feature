# language: es
Característica: Registro y trazabilidad offline
  Escenario: Registrar lote con evidencia declarada
    Dado un operador autenticado en su organización
    Cuando registra mineral con peso positivo y evidencia
    Entonces el lote queda Registered y la evidencia PendingReview

  Escenario: Recuperar captura sin conexión
    Dado que la aplicación fue cargada y la sesión iniciada con conexión
    Cuando captura sin red y recarga la aplicación
    Entonces la captura permanece Pending con el mismo clientEventId
    Cuando recupera la conexión
    Entonces se sincroniza automáticamente y queda Accepted tras la confirmación

  Escenario: Reintento idempotente
    Dado un evento Accepted
    Cuando se reenvía sin cambios con el mismo clientEventId
    Entonces devuelve AlreadyProcessed y existe un solo lote

  Escenario: Conflicto
    Dado un evento Accepted
    Cuando se reenvía su clientEventId con un peso diferente
    Entonces devuelve Conflict y conserva el lote original

  Escenario: Consulta por QR
    Dado un lote registrado con QR
    Cuando un usuario de su organización abre el enlace
    Entonces visualiza el lote correcto y su estado actual
    Pero una organización ajena recibe 404
