# Alcance verificable de Avance 4

El alcance de código acumulado suma **169 de 226 Story Points (74,8 %)**: 40 historias. Es una medida de funcionalidad implementada y sometida a revisión; no significa que 74,8 % de las pruebas o del código esté cubierto ni que todas las historias estén fusionadas. Las nuevas historias permanecen In review hasta completar revisión e integración de los PR #4 y #27.

| Incremento | Historias | SP |
| --- | ---: | ---: |
| Sprint 1 | 5 | 22 |
| Sprint 2 | 8 | 29 |
| Sprint 3 original | 17 | 69 |
| Historias adelantadas a Sprint 3 | 9 | 44 |

Los 57 SP restantes (13 historias) corresponden al Sprint 4, cuyo objetivo es completar las 53 historias y 226 SP, con todos sus criterios probados, revisión, integración y evidencia de despliegue. No se han cambiado las estimaciones del Product Backlog.

## Historias de este incremento

| Historia | Título | SP | Servicio | Evidencia principal |
| --- | --- | ---: | --- | --- |
| US12 | Registro inicial de lote | 3 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US14 | Modo Offline-First para registro | 8 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US15 | Sincronización automática de eventos | 5 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US16 | Prevención de duplicados por reintentos | 3 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US17 | Generación de Código QR identificador | 3 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US19 | Escaneo para aceptar custodia | 3 | Logistics | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US24 | Registro y comparación de peso en checkpoints | 3 | Logistics | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US26 | Recepción de lote en planta | 3 | Logistics | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US33 | Recepción de material vía código QR | 3 | Jewelry | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US35 | Registro manual de material externo | 3 | Jewelry | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US36 | Separación estricta de inventarios en UI | 5 | Jewelry | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US37 | Bloqueo de mezcla de inventarios | 5 | Jewelry | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US40 | Solicitud manual de certificado | 3 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US41 | Validación de árbol genealógico | 8 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US42 | Generación dinámica de PDF (Certificado) | 5 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US43 | Revocación de certificados | 3 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US51 | Consulta pública de trazabilidad (propuesta) | 5 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US52 | Consulta de vigencia del certificado (propuesta) | 3 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US44 | Visualización de certificados emitidos | 2 | Certification | [tests/jewelry-certification.test.js](../../tests/jewelry-certification.test.js) |
| US27 | Registro de análisis químico (Leyes) | 3 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US28 | División de lotes (Sub-lotes) | 8 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US29 | Fusión de lotes limpios | 5 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US30 | Declaración de Merma Técnica | 3 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US31 | Actualización de peso purificado | 3 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US32 | Marcado de lote Procesado | 2 | Processing | [tests/processing.test.js](../../tests/processing.test.js) |
| US18 | Cancelación de registro erróneo | 2 | Traceability | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US23 | Reporte de incidentes con evidencia fotográfica | 5 | Logistics | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US25 | Delegación de custodia intermedia | 5 | Logistics | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US45 | Dashboard de operaciones en vivo | 8 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US46 | Reporte histórico de Mermas | 5 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US47 | Exportación de evidencias para revisión ESG | 3 | Traceability + frontend | [tests/sprint1/](../../tests/sprint1/) |
| US13 | Validación de ubicación en geocerca | 5 | Traceability | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |
| US02 | Inicio de sesión seguro | 3 | Identity | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US05 | Gestión de Roles y Permisos | 5 | Identity | [tests/sprint2-access-custody.test.js](../../tests/sprint2-access-custody.test.js) |
| US07 | Registro de balanzas IoT | 8 | Devices | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |
| US08 | Registro de calibración de sensores | 3 | Devices | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |
| US09 | Alertas de desconexión Edge | 5 | Devices | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |
| US10 | Desactivación de hardware comprometido | 5 | Devices | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |
| US11 | Monitoreo de batería de sensores | 2 | Devices | [tests/devices-reporting-geofence.test.js](../../tests/devices-reporting-geofence.test.js) |

## Cierre del Sprint 4

| Historia pendiente | Título | SP |
| --- | --- | ---: |
| US53 | Asociación de materiales a la joya (propuesta) | 5 |
| US20 | Captura periódica de GPS en ruta | 5 |
| US21 | Alerta por desvío geográfico | 5 |
| US22 | Alerta por demora extrema | 3 |
| US34 | Ingesta automatizada vía API (ERP) | 8 |
| US01 | Registro de cuenta corporativa | 3 |
| US06 | Generación de API Keys (Joyerías) | 5 |
| US04 | Recuperación de contraseña | 2 |
| US03 | Autenticación Multifactor (2FA) | 5 |
| US38 | Rotación de API Keys (Seguridad) | 3 |
| US39 | Control de frecuencia de solicitudes de integración | 8 |
| US48 | Upgrade de plan de Suscripción | 5 |
| US49 | Downgrade de plan a fin de ciclo | 3 |
| US50 | Historial de facturación B2B | 2 |

## Evidencia y criterio de cierre

La matriz de criterios se conserva en [acceptance-matrix.md](acceptance-matrix.md). Es una trazabilidad entre requisito, implementación y suite; una referencia no demuestra por sí sola todas las ramas del criterio. Los resultados de ejecución deben acompañarse del commit y run exactos. No se asigna un porcentaje de cobertura de código ni de BDD a partir del número de historias.

Gherkin: [avance4-executable.feature](../../tests/features/avance4-executable.feature) se ejecuta con el runner Jest [avance4.test.js](../../tests/bdd/avance4.test.js), con nueve escenarios de negocio. El runner reconoce el subconjunto Escenario/Dado/Cuando/Entonces por identificador de escenario y orden, y falla ante escenarios sin implementación. No se afirma que se ejecutó Cucumber. El resto de criterios se verifica mediante las suites HTTP/MySQL, dominio y Playwright citadas.

La evidencia de cámara física, sensores reales, adopción de usuarios, métricas de impacto de negocio y despliegue AWS no se obtiene de las pruebas automatizadas. Se distingue de las verificaciones de software realizadas.
