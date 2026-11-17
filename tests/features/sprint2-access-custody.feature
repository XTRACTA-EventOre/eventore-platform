# language: es
# Implementaciones ejecutables: tests/sprint2-access-custody.test.js y tests/mysqlPersistence.test.js.
Característica: Roles, cancelación y aceptación inicial de custodia
  Escenario: Los permisos actualizados se aplican sin iniciar sesión otra vez
    Dado un operador con sesión vigente y un administrador de su organización
    Cuando el administrador cambia su rol a consulta
    Entonces su siguiente registro de lote se deniega
    Y el cambio conserva actor y roles en la auditoría
  Escenario: Cancelación de un lote antes de salir de origen
    Dado un lote registrado y un supervisor autorizado
    Cuando cancela indicando versión, identificador de operación y motivo
    Entonces el lote queda cancelado con actor, fecha y motivo
    Y repetir la misma operación no duplica el efecto
  Escenario: Dos transportistas aceptan la misma entrega al mismo tiempo
    Dado un lote registrado con una entrega vigente y sin restricciones
    Cuando dos transportistas autorizados aceptan la misma versión
    Entonces se confirma exactamente una custodia
    Y la otra operación informa conflicto
  Escenario: Se pierde la respuesta después de confirmar en trazabilidad
    Dado que la custodia fue confirmada en Traceability
    Cuando Logistics no recibe la respuesta
    Entonces su operación queda pendiente
    Y consultar o reintentar reconcilia la aceptación sin duplicarla
  Escenario: Actualización de una instalación MySQL existente
    Dada una base con usuarios y lotes del esquema anterior
    Cuando se aplican y repiten las migraciones nuevas
    Entonces se conservan usuarios y lotes
    Y se incorpora el nuevo estado sin alterar las migraciones anteriores
