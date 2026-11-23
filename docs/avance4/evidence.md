# Evidencias verificadas del incremento

| Producto | Revisión verificada | Resultado | Run |
| --- | --- | --- | --- |
| Backend | b77ffda7393735315be861b8b6160bd6bdab6d1a | 162 pruebas con MySQL; 27 suites; OpenAPI y Gherkin | [regresión 43635069428](https://github.com/XTRACTA-EventOre/eventore-platform/actions/runs/43635069428) |
| Infraestructura y API | b77ffda7393735315be861b8b6160bd6bdab6d1a | Structurizr DSL válido, Compose, variantes cloud/Caddy y Postman 29 solicitudes/38 aserciones | [aceptación 43635069344](https://github.com/XTRACTA-EventOre/eventore-platform/actions/runs/43635069344) |
| Frontend | 0de802d648d3114299eabe678d05dd978c8dc332 | 23 unitarias, build y 6 recorridos de navegador | [aceptación 43634905439](https://github.com/XTRACTA-EventOre/eventore/actions/runs/43634905439) |

Los artifacts `browser-evidence` contienen videos WebM, capturas PNG, PDF y CSV reales. `postman-evidence` conserva JUnit de la colección. Las tomas de Swagger ejecutan una consulta protegida HTTP 200; no se presentan como capturas de Postman gráfico. Los QR se comprueban mediante su enlace, y las balanzas mediante reportes autenticados API; no son pruebas de cámara o hardware físico.

La revisión Gitleaks del incremento backend y frontend no encontró filtraciones. cfn-lint validó localmente la plantilla AWS sin errores. Ninguna de estas verificaciones crea una cuenta AWS ni demuestra un despliegue público; esos pasos requieren cuenta y aprobación de gasto.

Las revisiones posteriores que cambien documentación deben conservar sus diferencias y checks propios. No se trasladan resultados de un commit a otro sin identificar qué cambió. El alcance disponible para revisión es [169/226 SP](scope.md); los PR [backend #4](https://github.com/XTRACTA-EventOre/eventore-platform/pull/4) y [frontend #27](https://github.com/XTRACTA-EventOre/eventore/pull/27) requieren aprobación e integración para cerrar historias como Done.
