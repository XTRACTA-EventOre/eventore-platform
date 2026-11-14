workspace "EventOre Avance 4" "Modelo del incremento implementado y despliegue AWS propuesto" {
  !impliedRelationships false
  model {
    operator = person "Personal autorizado" "Roles de origen, transporte, planta, joyeria y revision"
    consumer = person "Comprador" "Consulta publica sin sesion"
    deviceAdapter = softwareSystem "Adaptador de balanza" "Reportes autenticados; hardware fisico no validado"
    eventore = softwareSystem "EventOre" "Trazabilidad y evidencia revisable" {
      web = container "Frontend" "SPA, IndexedDB y consulta publica" "Vue y Vite"
      gateway = container "API Gateway" "Proxy, cookies y CORS" "Node Express"
      identity = container "Identity" "API y datos del contexto" "Node Express" {
      }
      identityDb = container "identity DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      traceability = container "Traceability" "API y datos del contexto" "Node Express" {
        routes = component "HTTP routes" "Autorizacion, tenant y version" "Express"
        policies = component "Domain policies" "Custodia, balance y genealogia" "JavaScript"
        persistence = component "Aggregate store" "Bloqueos y transaccion local" "MySQL adapter"
      }
      traceabilityDb = container "traceability DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      logistics = container "Logistics" "API y datos del contexto" "Node Express" {
      }
      logisticsDb = container "logistics DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      processing = container "Processing" "API y datos del contexto" "Node Express" {
      }
      processingDb = container "processing DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      jewelry = container "Jewelry" "API y datos del contexto" "Node Express" {
      }
      jewelryDb = container "jewelry DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      certification = container "Certification" "API y datos del contexto" "Node Express" {
      }
      certificationDb = container "certification DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      devices = container "Devices" "API y datos del contexto" "Node Express" {
      }
      devicesDb = container "devices DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
      reporting = container "Reporting" "API y datos del contexto" "Node Express" {
      }
      reportingDb = container "reporting DB" "Datos y credencial propios" "MySQL 8.4" {
        tags "Database"
      }
    }
    operator -> web "Opera segun permisos" "HTTPS"
    consumer -> web "Consulta el QR" "HTTPS"
    deviceAdapter -> gateway "Envia reportes con Bearer" "HTTPS"
    web -> gateway "Comandos y consultas" "HTTP dev y HTTPS cloud"
    gateway -> identity "Enruta API publica" "HTTP interno"
    identity -> identityDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> traceability "Enruta API publica" "HTTP interno"
    traceability -> traceabilityDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> logistics "Enruta API publica" "HTTP interno"
    logistics -> logisticsDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> processing "Enruta API publica" "HTTP interno"
    processing -> processingDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> jewelry "Enruta API publica" "HTTP interno"
    jewelry -> jewelryDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> certification "Enruta API publica" "HTTP interno"
    certification -> certificationDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> devices "Enruta API publica" "HTTP interno"
    devices -> devicesDb "Lee y escribe exclusivamente su base" "SQL"
    gateway -> reporting "Enruta API publica" "HTTP interno"
    reporting -> reportingDb "Lee y escribe exclusivamente su base" "SQL"
    traceability -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    logistics -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    logistics -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    processing -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    processing -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    jewelry -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    jewelry -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    certification -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    certification -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    devices -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    devices -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    reporting -> identity "Comprueba sesion y permisos actuales" "HTTP interno"
    reporting -> traceability "Comando de agregado o lectura autorizada" "HTTP interno"
    certification -> jewelry "Lee composicion vigente" "HTTP interno"
    routes -> policies "Valida comando"
    policies -> persistence "Consolida con control de version"
    persistence -> traceabilityDb "Estado, evidencia e historial atomicos" "SQL"
    deploymentEnvironment "AWS propuesto" {
      deploymentNode "AWS" "Diseno pendiente de cuenta y aprobacion de gasto" "Cloud" {
        infrastructureNode "CloudFront" "TLS viewer y acceso al origen" "AWS managed service"
        deploymentNode "EC2" "Una VM sin alta disponibilidad" "t3.large y Docker Compose" {
          containerInstance web
          containerInstance gateway
          containerInstance identity
          containerInstance identityDb
          containerInstance traceability
          containerInstance traceabilityDb
          containerInstance logistics
          containerInstance logisticsDb
          containerInstance processing
          containerInstance processingDb
          containerInstance jewelry
          containerInstance jewelryDb
          containerInstance certification
          containerInstance certificationDb
          containerInstance devices
          containerInstance devicesDb
          containerInstance reporting
          containerInstance reportingDb
        }
      }
    }
  }
  views {
    systemContext eventore "Context" {
      include *
      autoLayout lr
    }
    container eventore "Containers" {
      include *
      autoLayout tb
    }
    component traceability "TraceabilityComponents" {
      include *
      autoLayout lr
    }
    deployment eventore "AWS propuesto" "AwsProposed" {
      include *
      autoLayout tb
    }
    styles {
      element "Element" {
        color #152b26
        background #eef5f2
        stroke #41665b
      }
      element "Database" {
        shape Cylinder
        background #eeeeee
      }
      element "Person" {
        shape Person
      }
    }
  }
}
