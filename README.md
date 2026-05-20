
# Framework de Automatización con Playwright, K6 y TypeScript

---

### Descripción

Framework enterprise para automatización de pruebas funcionales (UI y API), de base de datos y de rendimiento, construido sobre **Playwright** y **TypeScript**. Diseñado con los principios de mantenibilidad, escalabilidad y trazabilidad como ejes centrales.

**Capacidades principales:**

- Patrón **Flow + POM** para separar lógica de negocio de la interacción con la UI.
- **Fixtures centralizadas** en `src/config/fixtures/` para inyección de dependencias (UI, API, BD).
- Sistema de **placeholders** `%NOMBRE_VARIABLE%` resueltos automáticamente desde `.env` tanto en Playwright como en k6.
- Generación automática de casos de prueba a partir de archivos JSON de datos (un test por escenario).
- **Validación de schemas** de respuestas de API con AJV + `ajv-formats` (Playwright) y validador equivalente para k6.
- **Autenticación de API** dual: credenciales estáticas (`apiAuth.ts`) y Azure Active Directory via `DefaultAzureCredential`.
- **Integración nativa con Azure DevOps**: publicación automática de resultados, adjuntos de evidencia, detección de tests flaky y creación de bugs por fallos.
- **Pruebas de rendimiento** con k6 reutilizando los mismos datos y schemas de las pruebas de API.
- Reportes HTML interactivos, JUnit XML y dashboard k6, con logs nombrados dinámicamente por ejecución.
- Pipeline CI/CD listo para **GitHub Actions** y **Azure DevOps**.

---

### Contenido

- [Prerequisitos](#prerequisitos)
- [Instalación](#instalación)
- [Arquitectura del Framework](#arquitectura-del-framework)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso](#uso)
  - [Pruebas de UI](#1-pruebas-de-ui-navegador)
  - [Pruebas de Base de Datos](#2-pruebas-de-base-de-datos-oracle)
  - [Pruebas de API](#3-pruebas-de-api)
  - [Pruebas de Performance](#4-pruebas-de-performance-k6)
- [Estrategia de Tags](#estrategia-de-tags)
- [Integración Azure DevOps](#integración-azure-devops)
- [Ejecución](#ejecución)
- [Variables de Entorno](#variables-de-entorno)
- [Reportes](#reportes)
- [Integración CI/CD](#integración-cicd)
- [Contribución](#contribución)
- [Troubleshooting](#troubleshooting)
- [Extensiones Recomendadas para VSCode](#extensiones-recomendadas-para-vscode)

---

### Prerequisitos

1. **[Node.js](https://nodejs.org/en)** v24.x LTS o superior
2. **[Visual Studio Code](https://code.visualstudio.com/download)** (última versión recomendada)
3. Extensión **[Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)**
4. **[K6](https://grafana.com/docs/k6/latest/set-up/install-k6/)** — el script `postinstall` intenta instalarlo automáticamente vía Chocolatey en Windows:

```bash
# Windows (Chocolatey)
choco install k6

# Windows (winget)
winget install k6 --source winget

# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo apt-get install k6
```

---

### Instalación

1. Clonar el repositorio:

```bash
git clone <Link_del_repositorio>
```

2. Instalar dependencias (incluye browsers de Playwright y k6 vía `postinstall`):

```bash
npm install
```

> **NOTA:** El script `postinstall` ejecuta `install:k6` (detecta el SO e instala k6 si no está presente) e `install:playwright` (instala los navegadores de Playwright con sus dependencias del sistema).

3. Configurar las variables de entorno copiando la plantilla del ambiente a usar:

```bash
# Editar el archivo correspondiente con los valores del ambiente
.env.dev   # Desarrollo
.env.qa    # QA
.env.prod  # Producción
```

---

### Arquitectura del Framework

El framework implementa una separación estricta de responsabilidades en cuatro capas:

```
Specs (WHAT to test)
  └── Flows (HOW the business logic works)
        └── POM (WHERE the UI elements are)
              └── Fixtures (WHO provides the dependencies)
```

| Capa | Responsabilidad | Ubicación |
|------|----------------|-----------|
| **Spec** | Define los casos de prueba y aserciones | `src/test/specs/` |
| **Flow** | Orquesta pasos de negocio de alto nivel | `src/test/flows/` |
| **POM** | Encapsula localizadores y acciones de página | `src/test/pom/` |
| **Fixture** | Provee servicios inyectados (API, BD, POM) | `src/config/fixtures/` |
| **Config** | Servicios base: HTTP, Oracle, logs, Azure | `src/config/` |

**Principios de diseño aplicados:**
- **DRY**: datos de prueba compartidos entre Playwright, k6 y Azure DevOps.
- **Single Responsibility**: cada capa tiene una única razón para cambiar.
- **Open/Closed**: añadir un nuevo módulo no modifica los existentes (registrar POM en fixture, crear JSON de datos).
- **Inversión de dependencias**: los specs nunca instancian servicios directamente; los reciben vía fixture.

---

### Estructura del Proyecto

```plaintext
├── .github/
│   └── workflows/
│       └── gitHubPipeline.yml              # Pipeline CI/CD de GitHub Actions
├── .vscode/
│   ├── extensions.json                     # Extensiones recomendadas para el equipo
│   └── settings.json                       # Configuración del editor para el proyecto
├── apiToUpdateTestCase/
│   ├── Azure-Devops.postman_collection.json        # Colección Postman para gestión de TCs en Azure DevOps
│   └── Azure-devops-test.postman_environment.json  # Variables de entorno Postman para Azure DevOps
├── azurePipelineFormat/
│   └── azure-pipelines.yml                 # Pipeline CI/CD de Azure DevOps
├── logs/
│   └── .gitkeep                            # Directorio versionado; los logs se generan en ejecución
├── src/
│   ├── config/
│   │   ├── API/
│   │   │   ├── apiAuth.ts                  # Credenciales estáticas y autenticación Azure AD
│   │   │   ├── apiConfig.ts                # Cliente HTTP (GET, POST, PUT, PATCH, DELETE)
│   │   │   ├── apiSchemaValidator.ts       # Validación AJV + ajv-formats sobre JSON Schemas
│   │   │   └── apiServices.ts              # Orquestador: resolución de auth, headers y logging
│   │   ├── DB/
│   │   │   ├── DBConnectionConfig.ts       # Registro de credenciales por base de datos y usuario
│   │   │   ├── oracleConfig.ts             # Clase OracleDB: conexión, ejecución de queries y cierre
│   │   │   └── oracleService.ts            # Servicio de alto nivel para ejecutar queries Oracle
│   │   ├── fixtures/
│   │   │   ├── api.fixture.ts              # Fixture: provee ApiService
│   │   │   ├── database.fixture.ts         # Fixture: provee DatabaseService y cierra conexión al finalizar
│   │   │   ├── index.ts                    # Punto de entrada: combina fixtures y captura errores de consola
│   │   │   ├── pom.fixture.ts              # Fixture: provee instancias de los POMs registrados
│   │   │   └── worldData.fixture.ts        # Contexto compartido: dataJson, dataquery, dataApiResponse
│   │   ├── integracion-azure/
│   │   │   ├── types/
│   │   │   │   └── azure.types.ts          # Interfaces TypeScript: AzureConfiguration, TestResult, WorkItem
│   │   │   ├── ActiveDefectRegistry.ts     # Registro de bugs activos para evitar duplicados
│   │   │   ├── AttachmentService.ts        # Sube screenshots, trazas y logs a Azure DevOps
│   │   │   ├── AzureConfig.ts              # Carga y valida la configuración desde variables de entorno
│   │   │   ├── AzureDevOpsClient.ts        # Cliente HTTP para la REST API de Azure DevOps
│   │   │   ├── AzureIntegrationReporter.ts # Reporter principal: publica resultados al finalizar
│   │   │   ├── BugManager.ts               # Crea y actualiza work items (bugs) en Azure DevOps
│   │   │   ├── DuplicateBugDetector.ts     # Detecta bugs duplicados antes de crearlos
│   │   │   ├── ErrorFingerprintService.ts  # Genera firma de error para categorización
│   │   │   ├── EvidenceCollector.ts        # Recolecta artefactos: screenshots, video, trace
│   │   │   ├── ExecutionTracker.ts         # Rastrea el estado de ejecución por test
│   │   │   ├── FlakyDetector.ts            # Identifica tests flaky según umbral de reintentos
│   │   │   ├── ResultPublisher.ts          # Orquesta la publicación de resultados
│   │   │   ├── TestCaseResolver.ts         # Mapea tests Playwright a TCs de Azure via @TC### tags
│   │   │   ├── TestResultService.ts        # Publica outcomes con duración y mensaje de error
│   │   │   └── index.ts                    # Exportaciones públicas del módulo
│   │   ├── performance/
│   │   │   ├── loadData.ts                 # Carga escenario y schema desde los JSON compartidos
│   │   │   ├── rateLimitHandler.ts         # Ejecuta las fases del rate limit (dentro/sobre límite/retry-after)
│   │   │   ├── rateLimitScenarioConfig.ts  # Genera opciones k6: iteraciones y tiempos por escenario de rate limit
│   │   │   ├── rateLimitTypes.ts           # Tipos RateLimitConfig y RateLimitData + validación asRateLimitData
│   │   │   ├── replacePlaceHoldersPerf.ts  # Resuelve %VARIABLE% con valores de __ENV en k6
│   │   │   ├── requestHandler.ts           # Envía request HTTP en k6 y valida status + schema
│   │   │   ├── scenarioConfig.ts           # Genera opciones k6: perfiles de carga y thresholds
│   │   │   └── validator.ts                # Validador JSON Schema nativo para k6 (mirror de AJV)
│   │   ├── CustomReporter.ts               # Reporter: registra feature, scenario y steps en el log
│   │   └── logConfig.ts                    # Clase Logs: archivo por ejecución y colores ANSI
│   ├── test/
│   │   ├── data/
│   │   │   ├── API/
│   │   │   │   ├── schemas/
│   │   │   │   │   └── apiExampleSchemas.json      # JSON Schemas para validación de responses
│   │   │   │   └── apiExample.json                 # Escenarios de API: método, URL, headers, auth, payload
│   │   │   ├── portal/
│   │   │   │   └── consultaRnc.json                # Datos de prueba para consulta RNC
│   │   │   └── pruebaEjecucionQuery.json            # Datos para pruebas Oracle
│   │   ├── flows/
│   │   │   ├── API/
│   │   │   │   └── ejecucionAPI.flow.ts             # Ejecuta el request y valida el schema de respuesta
│   │   │   └── portal/
│   │   │       └── consultaRNC.flow.ts              # Navegación por menú y búsqueda por RNC
│   │   ├── performance/
│   │   │   ├── performanceTest.ts                   # Entry point de k6 para pruebas de carga
│   │   │   └── rateLimitTest.ts                     # Entry point de k6 para pruebas de rate limit y retry-after
│   │   ├── pom/
│   │   │   └── portal/
│   │   │       └── consultaRNC.ts                   # Page Object Model: selectores y acciones RNC
│   │   └── specs/
│   │       ├── API/
│   │       │   └── ejecucionApi.spec.ts             # Spec de API: un test por escenario del JSON
│   │       ├── DataBase/
│   │       │   └── ejecucionOracle.spec.ts          # Spec de BD: queries Oracle
│   │       └── portal/
│   │           ├── accederDGII.spec.ts              # Spec de UI: acceso al portal DGII
│   │           └── consultaRNC.spec.ts              # Spec de UI: consulta de RNC
│   └── utilidades/
│       └── playwright-utilidades.ts                 # Funciones: replacePlaceholders, isValidUrl, obtenerVariablesVacias
├── .env.dev                                         # Variables de ambiente para desarrollo
├── .env.qa                                          # Variables de ambiente para QA
├── .env.prod                                        # Variables de ambiente para producción
├── .gitignore
├── Docker_Command.txt                               # Referencia rápida de comandos Docker
├── ejecucionPerformance.ts                          # Runner k6: carga env, inyecta token Azure y ejecuta k6
├── ejecucionRateLimit.ts                            # Runner k6: valida rate limit y retry-after por escenario
├── instalarK6.ts                                    # Instalación automática de k6 multiplataforma
├── package.json
├── package-lock.json
├── playwright.config.ts                             # Configuración de Playwright: proyectos, reportes y timeouts
├── runner.ts                                        # Runner: parsea args, nombra log/reporte e invoca npx
├── tsconfig.json                                    # TypeScript para Playwright y Node.js (CommonJS)
└── tsconfig.k6.json                                 # TypeScript para k6 (ESNext/bundler, noEmit)
```

---

### Uso

#### 1. Pruebas de UI (Navegador)

1. Crear el spec en **`src/test/specs/<sistema>/`**. [Ver ejemplo](src/test/specs/portal/consultaRNC.spec.ts)
2. Crear el JSON de datos en **`src/test/data/<sistema>/`**. [Ver ejemplo](src/test/data/portal/consultaRnc.json)
3. Crear el POM en **`src/test/pom/<sistema>/`**. [Ver ejemplo](src/test/pom/portal/consultaRNC.ts)
4. Crear el flow en **`src/test/flows/<sistema>/`**. [Ver ejemplo](src/test/flows/portal/consultaRNC.flow.ts)
5. Registrar el POM en **`src/config/fixtures/pom.fixture.ts`**. [Ver ejemplo](src/config/fixtures/pom.fixture.ts)
6. Actualizar los archivos `.env` con las variables necesarias.

#### 2. Pruebas de Base de Datos (Oracle)

Verificar que las credenciales existan en [DBConnectionConfig](src/config/DB/DBConnectionConfig.ts) y que sus valores estén en los archivos `.env`. Luego agregar el caso de prueba al spec. [Ver ejemplo](src/test/specs/DataBase/ejecucionOracle.spec.ts)

El contexto **`WorldData`** expone las siguientes funciones:

| Función | Descripción |
|---------|-------------|
| `obtenerDataQuery()` | Retorna el array completo de filas del resultado del query |
| `obtenerCeldaQuery(columna, fila)` | Retorna el valor de una columna en una fila específica (índice desde 1) |

#### 3. Pruebas de API

1. Crear el JSON de escenarios en **`src/test/data/API/`**. [Ver ejemplo](src/test/data/API/apiExample.json)
2. Si se valida schema, agregar el JSON Schema en **`src/test/data/API/schemas/`**. [Ver ejemplo](src/test/data/API/schemas/apiExampleSchemas.json)
3. Referenciar el archivo desde el spec usando `DATA_FILE`. El spec itera automáticamente sobre todas las claves, generando un test por escenario. [Ver ejemplo](src/test/specs/API/ejecucionApi.spec.ts)

**Función `obtenerDataApiResponse(key)`** del contexto `worldData`:

| Uso | Descripción |
|-----|-------------|
| `obtenerDataApiResponse(campo)` | Un campo específico del response |
| `obtenerDataApiResponse()` | Response completo serializado como JSON string |

##### Estructura del JSON de escenarios de API

```json
{
  "nombreEscenario": {
    "metodo": "get|post|put|patch|delete",
    "statusEsperado": 200,
    "urlBase": "%NOMBRE_VARIABLE_ENV%",
    "endpoint": "/ruta/del/recurso",
    "header": { "Content-Type": "application/json" },
    "autorizacion": "",
    "payload": {},
    "schemaRef": "nombreArchivoSchema",
    "transacciones": 400,
    "rateLimit": {
      "peticionesPermitidas": 5,
      "statusRateLimit": 429,
      "retryAfterSegundos": 10
    }
  }
}
```

> **Campo `autorizacion`:**
> - Nombre de clave definida en `apiAuth.ts` (ej: `"bearerToken"`, `"apiKeyDev"`) → credenciales estáticas.
> - URL de scope de Azure AD (ej: `"https://..."`) → token via `DefaultAzureCredential` (identidad administrada en pipelines, `az login` en local).

##### Sistema de placeholders

Los valores en los JSON pueden contener marcadores `%NOMBRE_VARIABLE%`. Se resuelven automáticamente:
- En **Playwright**: desde `process.env` al cargar con `cargarDataFeature`.
- En **k6**: desde `__ENV` al cargar con `cargarEscenario`.

```json
{ "urlBase": "%API_PET_BASE_URL%" }
```

#### 4. Pruebas de Performance (k6)

Los archivos de data de API (`src/test/data/API/`) son compartidos con k6. No se crean archivos separados.

1. Verificar que el escenario tenga `schemaRef` y `transacciones` definidos.
2. Ejecutar indicando archivo, escenario y ambiente. [Ver sección Ejecución](#ejecución)

##### Perfiles de carga disponibles

Los perfiles se calculan dinámicamente a partir del valor `transacciones` del escenario (TPS en carga alta):

| Perfil | TPS configurado | Duración |
|--------|----------------|----------|
| `low` (activo por defecto) | 1% de `transacciones` | 1 min |
| `medium` | 50% de `transacciones` | 30 min |
| `high` | 100% de `transacciones` | 60 min |
| `stress` | 200% de `transacciones` | 60 min |
| `endurance` | 150% de `transacciones` | 12 h |

> Para activar múltiples perfiles simultáneamente, descomentar `scenarios: allProfiles` en [scenarioConfig.ts](src/config/performance/scenarioConfig.ts).

##### Thresholds configurados

| Métrica | Umbral |
|---------|--------|
| `http_req_duration` p(90) | < 500 ms |
| `http_req_duration` p(99) | < 1200 ms |
| `http_req_failed` | < 1% |
| `checks` (general) | > 99% |
| `checks` "Validar status code" | > 99% |

##### Perfiles de carga — activar / desactivar

Los perfiles se configuran en el array `SPECS` dentro de [scenarioConfig.ts](src/config/performance/scenarioConfig.ts). Por defecto solo `low` está activo; para habilitar más perfiles, descomentar las entradas correspondientes. `CICLO_TOTAL_MIN` se calcula automáticamente a partir del último perfil activo.

#### 4.1. Pruebas de Rate Limit y Retry-After

Valida que el servicio respete el límite de peticiones permitidas y que se recupere correctamente tras el período de retry-after. Reutiliza los mismos archivos JSON de `src/test/data/API/`; solo requiere añadir el campo `rateLimit` a cada escenario.

##### Fases de ejecución por escenario

| Fase | Iteraciones | Acción | Validación |
|------|-------------|--------|------------|
| **Dentro del límite** | 0 … N-1 | Envía N peticiones normales | `statusEsperado` + schema (si aplica) |
| **Sobre el límite** | N | Envía la petición N+1 | `statusRateLimit` (ej. 429) |
| **Tras retry-after** | N+1 | Espera `retryAfterSegundos`, reintenta | `statusEsperado` — el servicio se recuperó |

##### Thresholds de rate limit

| Métrica | Umbral |
|---------|--------|
| `http_req_duration` p(90) | < 2000 ms |
| `http_req_duration` p(95) | < 3000 ms |
| `checks{fase:dentro_limite}` | 100% |
| `checks{fase:sobre_limite}` | 100% |
| `checks{fase:tras_retry_after}` | 100% |

---

### Estrategia de Tags

Los tags permiten filtrar y organizar la ejecución de pruebas. Se aplican en el título del `test()` dentro del spec.

#### Tags de nivel de suite

| Tag | Propósito | Ejemplo de uso |
|-----|-----------|---------------|
| `@smoke` | Pruebas de humo para validación rápida post-deploy (UI) | `npm run chrome tags=@smoke env=qa` |
| `@regression` | Suite de regresión completa (UI) | `npm run chrome tags=@regression env=qa` |
| `@smokeApi` | Pruebas de humo para APIs | `npm run api tags=@smokeApi env=qa` |

#### Tags de trazabilidad con Azure DevOps

El formato `@TC###` vincula cada test de Playwright con un caso de prueba en Azure DevOps. Es **obligatorio** para que la integración publique el resultado al TC correspondiente.

```typescript
test('Usuario consulta', { tag: ['@smoke', '@regression', '@first','@TC32'] }, async ({ ... }) => {
  // El resultado de este test se publicará en el TC#123 de Azure DevOps
});
```

> Un test puede tener múltiples tags: `@TC123 @smoke @regression`.

#### Ejecución por tag

```bash
# Ejecutar solo pruebas de humo en Chrome
npm run chrome tags=@smoke env=qa

# Ejecutar un caso de prueba específico por su ID de Azure DevOps
npm run chrome tags=@TC123 env=qa

# Ejecutar pruebas de regresión de API
npm run api tags=@regression env=qa
```

---

### Integración Azure DevOps

El framework incluye una integración completa con Azure DevOps (`src/config/integracion-azure/`) que se activa configurando las variables de entorno correspondientes. Cuando está habilitada, el reporter `AzureIntegrationReporter` ejecuta automáticamente al finalizar cada test run.

#### Funcionalidades

| Funcionalidad | Descripción |
|--------------|-------------|
| **Publicación de resultados** | Publica passed/failed/skipped con duración y mensaje de error en el Test Run de Azure DevOps |
| **Adjuntos de evidencia** | Sube screenshots, videos y trazas de Playwright a cada resultado de TC |
| **Detección de tests flaky** | Identifica tests que pasaron tras reintentos según el umbral `Reintentos` |
| **Creación automática de bugs** | Crea work items (bugs) en Azure DevOps para tests fallidos (configurable) |
| **Deduplicación de bugs** | Verifica si ya existe un bug activo con la misma firma de error antes de crear uno nuevo |
| **Fingerprinting de errores** | Genera una firma única por tipo de error para agrupar fallos relacionados |

#### Configuración

Activar la integración en el archivo `.env` del ambiente:

```env
AZURE_DEVOPS_INTEGRATION_ENABLED=true
AZURE_DEVOPS_ORG=mi-organizacion
AZURE_DEVOPS_PROJECT=mi-proyecto
AZURE_TESTPLAN_ID=123
AZURE_TESTSUITE_ID=456
ENABLE_BUG_CREATION=true
```

La autenticación usa **Microsoft Entra ID** via `DefaultAzureCredential` (`@azure/identity`). No se requiere un PAT. En local, autenticarse previamente con `az login --tenant <tenant-id>`; en pipelines, configurar la Managed Identity del agente o las variables `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET`.

El scope por defecto es `https://app.vssps.visualstudio.com/.default`. Si la organización requiere uno distinto, sobreescribirlo con `AZURE_DEVOPS_SCOPE`.

#### Flujo de publicación

```
Test Run finaliza
  └── AzureIntegrationReporter.onEnd()
        ├── TestCaseResolver   → Mapea @TC### a IDs de Azure DevOps
        ├── ExecutionTracker   → Consolida estado final por test
        ├── FlakyDetector      → Marca tests flaky (retries > FLAKY_THRESHOLD)
        ├── ResultPublisher
        │     ├── TestResultService  → Publica outcomes al Test Run
        │     ├── EvidenceCollector  → Recolecta screenshots, video, trace
        │     └── AttachmentService  → Sube artefactos a Azure DevOps
        └── BugManager (si ENABLE_BUG_CREATION=true)
              ├── ErrorFingerprintService → Genera firma del error
              ├── DuplicateBugDetector   → Verifica duplicados
              └── Crea work item (Bug) si no existe
```

#### Permisos requeridos en Azure DevOps

La identidad autenticada (usuario local o Managed Identity del pipeline) debe tener los siguientes permisos en el proyecto:
- **Test Management**: Read & Write
- **Work Items**: Read & Write (si se habilita `ENABLE_BUG_CREATION=true`)

---

### Ejecución

#### Pruebas de UI y API (Playwright)

```bash
# Microsoft Edge
npm run edge folder=<folder> feature=<nombre-feature> tags=@<tag> env=<dev/qa/prod> workers=<numero>

# Chrome
npm run chrome folder=<folder> feature=<nombre-feature> tags=@<tag> env=<dev/qa/prod> workers=<numero>

# Firefox
npm run firefox folder=<folder> feature=<nombre-feature> tags=@<tag> env=<dev/qa/prod> workers=<numero>

# Safari (WebKit)
npm run safari folder=<folder> feature=<nombre-feature> tags=@<tag> env=<dev/qa/prod> workers=<numero>

# APIs (sin navegador)
npm run api folder=<folder> feature=<nombre-feature> tags=@<tag> env=<dev/qa/prod> workers=<numero>

# UI interactivo de Playwright
npm run test:ui
```

> **Parámetros opcionales:** `folder`, `feature`, `tags` y `workers`. Si se omiten, se ejecutan todos los casos del ambiente con un worker. En CI se fuerza `headless: true` y 2 workers por defecto.

**Ejemplos de uso frecuente:**

```bash
# Regresión completa en Chrome contra QA
npm run chrome env=qa tags=@regression workers=4

# Suite de humo post-deploy en Edge
npm run edge env=prod tags=@smoke

# Un módulo específico
npm run chrome folder=portal feature=consultaRNC env=qa

# Un caso de prueba por ID de Azure DevOps
npm run chrome tags=@TC123 env=qa
```

#### Pruebas de Performance (k6)

```bash
# Un escenario específico
npm run perf env=<dev/qa/prod> data_file=<nombre-archivo> scenario=<clave-escenario>

# Todos los escenarios del archivo
npm run perf env=<dev/qa/prod> data_file=<nombre-archivo>
```

**Ejemplo:**

```bash
npm run perf env=dev data_file=apiExample scenario=escenario3
npm run perf env=qa data_file=apiExample
```

> `data_file` referencia un archivo dentro de `src/test/data/API/` (sin extensión). `scenario` es la clave del escenario dentro de ese archivo; si se omite, se ejecutan todos los escenarios del archivo de forma secuencial. Si el escenario usa autenticación Azure AD, el runner obtiene el token antes de iniciar k6 y lo inyecta via `AZURE_TOKEN`.

El reporte HTML de k6 se genera en: `reports/K6-report/performance_dashboard_<data_file>_<timestamp>.html`

#### Pruebas de Rate Limit (k6)

```bash
# Un escenario específico
npm run ratelimit env=<dev/qa/prod> data_file=<nombre-archivo> scenario=<clave-escenario>

# Todos los escenarios del archivo
npm run ratelimit env=<dev/qa/prod> data_file=<nombre-archivo>
```

**Ejemplo:**

```bash
npm run ratelimit env=dev data_file=apiExample scenario=escenario1
npm run ratelimit env=qa data_file=apiExample
```

> Requiere que cada escenario tenga el campo `rateLimit` en el JSON de datos. Los escenarios se ejecutan de forma secuencial; el siguiente comienza tras la duración estimada del anterior (basada en `peticionesPermitidas` y `retryAfterSegundos`).

El reporte HTML se genera en: `reports/K6-report/rateLimit_dashboard_<data_file>_<timestamp>.html`

---

### Variables de Entorno

Cada archivo `.env.<ambiente>` debe contener las siguientes variables. Las marcadas con `*` son **obligatorias** para que la funcionalidad correspondiente opere.

#### Framework

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `ENV` | Ambiente activo (`dev`, `qa`, `prod`) | — |
| `HEADLESS` | Modo headless del navegador | `false` (local), `true` (CI) |
| `WORKERS` | Número de workers paralelos | `1` |

#### Portal / UI

| Variable | Descripción |
|----------|-------------|
| `PORTAL_DGII` | URL base del portal a probar |

#### API

| Variable | Descripción |
|----------|-------------|
| `API_PET_BASE_URL` | URL base de la API (ejemplo: PetStore) |
| `API_QA_BEARER_TOKEN` | Token Bearer estático para autenticación |
| `API_Key_DEV` | API Key para ambiente de desarrollo |
| `AZURE_API_SCOPE` | Scope de Azure AD para obtener token OAuth2 |

#### Base de Datos (Oracle)

| Variable | Descripción |
|----------|-------------|
| `DB_CADENA_QASB` | Connection string Oracle para BD `QASB` |
| `DB_PASSWORD_QASB_USER` | Password Oracle para usuario `USER` en `QASB` |
| `DB_CADENA_QADB01` | Connection string Oracle para BD `qadb01` |
| `DB_PASSWORD_QADB01_USER` | Password Oracle para usuario `USER` en `qadb01` |

#### Integración Azure DevOps

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `AZURE_DEVOPS_INTEGRATION_ENABLED` | Habilita la integración (`true`/`false`) | Para integración |
| `AZURE_DEVOPS_ORG`* | Nombre de la organización en Azure DevOps | Sí |
| `AZURE_DEVOPS_PROJECT`* | Nombre del proyecto | Sí |
| `AZURE_TESTPLAN_ID`* | ID del Test Plan en Azure DevOps | Sí |
| `AZURE_TESTSUITE_ID`* | ID del Test Suite | Sí |
| `AZURE_DEVOPS_SCOPE` | Scope de Entra ID para la API de Azure DevOps | `https://app.vssps.visualstudio.com/.default` |
| `AZURE_API_VERSION` | Versión de la API de Azure DevOps | `7.1` |
| `MAX_RETRIES` | Reintentos para llamadas HTTP a Azure DevOps | `3` |
| `ENABLE_BUG_CREATION` | Crea bugs automáticamente por fallos | `false` |
| `ENABLE_TRACE_ATTACHMENTS` | Adjunta trazas de Playwright a Azure DevOps | `true` |
| `AZURE_TLS_REJECT_UNAUTHORIZED` | Validación TLS en peticiones a Azure DevOps | `true` |

> **Autenticación**: la integración usa **Microsoft Entra ID** (`DefaultAzureCredential`), no PAT. En local ejecutar `az login --tenant <tenant-id>` antes de las pruebas. En pipelines, asignar la Managed Identity o configurar `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET` como variables del agente.

---

### Reportes

| Reporte | Ruta | Descripción |
|---------|------|-------------|
| HTML Playwright | `reports/playwright-report/<nombre-ejecucion>/` | Reporte interactivo con capturas, videos, trazas y datos adjuntos |
| JUnit XML | `reports/temp/xml/results.xml` | Para integración con Azure DevOps / GitHub Actions |
| JSON | `reports/temp/json/results.json` | Resultados en formato JSON para procesamiento externo |
| Dashboard k6 | `reports/K6-report/performance_dashboard_*.html` | Dashboard exportado del Web Dashboard de k6 |
| Logs | `logs/<nombre-ejecucion>-logs.txt` | Log de texto por ejecución con steps, errores y parámetros |

El nombre de cada ejecución se genera dinámicamente con el formato: `<ambiente>-<navegador>-<timestamp>`, garantizando histórico sin sobreescritura.

---

### Integración CI/CD

#### GitHub Actions (`gitHubPipeline.yml`)

- **Triggers**: push/PR a `main`/`master` y ejecución manual (`workflow_dispatch`).
- **Parámetros manuales**: `browser`, `folder`, `feature`, `tags`, `env`, `workers`, `perf`.
- **Agente**: `windows-latest` (hosted).
- **Node.js**: versión LTS más reciente (`lts/*`).
- **Artefactos publicados**: reportes HTML (`reports/playwright-report/`), dashboard k6 (`reports/K6-report/`) y logs (`logs/`) con retención de 30 días.
- **Publicación JUnit**: via `dorny/test-reporter@v1` (omitido si `browser=perf`).

#### Azure DevOps (`azure-pipelines.yml`)

- **Triggers**: push/PR a `main`/`master`.
- **Parámetros manuales**: `browser`, `folder`, `feature`, `tags`, `env`, `paralelo`.
- **Agente**: on-premise (`poolName: onpremise`), configurable para Windows/macOS en paralelo.
- **Node.js**: `>=20.x`.
- **Grupo de variables**: `ConexionBD` (credenciales Oracle mapeadas como variables de entorno).
- **Reintentos automáticos**: `retryCountOnTaskFailure: 2` en el step de ejecución.
- **Artefactos publicados**: reportes HTML y logs como `PipelineArtifact`; resultados JUnit via `PublishTestResults@2`.

---

### Contribución

1. Crear una rama desde `main` con nombre descriptivo (`feature/`, `fix/`, `refactor/`).
2. Implementar el cambio siguiendo la estructura de capas del framework (spec → flow → pom → fixture).
3. Asegurarse de que el nuevo código tenga tags de nivel de suite (`@smoke` o `@regression`) y tag de trazabilidad (`@TC###`) si aplica.
4. Validar localmente contra al menos un ambiente antes de enviar el PR:
   ```bash
   npm run chrome folder=<modulo-modificado> env=qa
   ```
5. Actualizar los archivos `.env` si se agregan nuevas variables (documentarlas en este README).
6. Actualizar el YAML del pipeline si se modifican scripts o dependencias de CI.
7. Enviar un pull request con descripción clara de los cambios, casos cubiertos e impacto en la suite existente.

---

### Troubleshooting

#### Los browsers no se instalan al hacer `npm install`

```bash
# Instalar manualmente
npm run install:playwright
```

#### k6 no se encuentra tras la instalación

```bash
# Instalar manualmente (detecta el SO)
npm run install:k6

# Verificar instalación
k6 version
```

#### La integración con Azure DevOps no publica resultados

1. Verificar que `AZURE_DEVOPS_INTEGRATION_ENABLED=true` en el `.env` activo.
2. Verificar que los IDs de `AZURE_TESTPLAN_ID` y `AZURE_TESTSUITE_ID` existan en el proyecto.
3. Verificar que los tests tengan el tag `@TC###` con IDs válidos.
4. Revisar los logs de ejecución en `logs/` para mensajes `[Azure]` — indican el estado de cada operación.

#### La autenticación Entra ID falla en local

```bash
# Autenticarse con el tenant corporativo donde está el proyecto Azure DevOps
az login --tenant <tenant-id>

# Verificar que la cuenta activa tiene acceso al proyecto
az account show
```

En pipelines, verificar que la Managed Identity del agente tenga acceso al proyecto de Azure DevOps, o que las variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_CLIENT_SECRET` estén configuradas en el grupo de variables del pipeline.

#### Los placeholders `%VARIABLE%` no se resuelven

Verificar que la variable esté definida en el archivo `.env.<ambiente>` correspondiente al `env` de ejecución y que el nombre coincida exactamente (case-sensitive).

#### Tests fallan solo en CI (headless) pero pasan en local

- Agregar `await page.waitForLoadState('networkidle')` en los pasos críticos del flow.
- Verificar que los localizadores del POM sean lo suficientemente específicos y no dependan del tamaño de ventana.
- Revisar si el CI tiene acceso de red a las URLs referenciadas en las variables de entorno.

---

### Extensiones Recomendadas para VSCode

Las extensiones están configuradas en `.vscode/extensions.json`. VSCode notificará para instalarlas automáticamente al abrir el proyecto.

| Extensión | ID |
|-----------|----|
| Playwright Test for VSCode | `ms-playwright.playwright` |
| Azure Git Repos | `ms-vscode.azure-repos` |
| Material Icon Theme | `material-icon-theme.material-icon-theme` |
| Playwright Code Snippets | `playwright.playwright-code-snippets` |
