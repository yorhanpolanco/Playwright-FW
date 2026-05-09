
# Framework de Automatización con Playwright, K6 y TypeScript

----

### Descripción

Framework para la automatización de pruebas funcionales, de API, de base de datos y de rendimiento, construido con Playwright y TypeScript. Incluye las siguientes funcionalidades:

- Generación de logs con nombre dinámico por ejecución (ambiente, navegador, contexto y timestamp).
- Posibilidad de utilizar la extensión de Playwright para grabar scripts y reutilizarlos en el framework.
- Fixtures centralizadas en `src/config/fixtures/` para administrar contextos e inyección de dependencias por tipo de prueba (UI, API, BD).
- Patrón de diseño **Flow + POM (Page Object Model)** para separar la lógica de negocio de la interacción con la UI.
- Sistema de **placeholders** `%NOMBRE_VARIABLE%` en archivos JSON de datos, resueltos automáticamente desde variables de entorno tanto en Playwright (`process.env`) como en k6 (`__ENV`).
- Uso de datos de prueba desde archivos JSON compartidos entre pruebas Playwright y k6.
- Generación automática de casos de prueba: el spec de API itera sobre todas las claves del archivo JSON de datos, creando un test por escenario sin modificar el spec.
- Validación de schemas de respuestas de API con **AJV** + `ajv-formats` (Playwright) y un validador JSON Schema equivalente para k6, usando los mismos archivos de schema.
- Autenticación de API con soporte para dos modos: credenciales estáticas configuradas en `apiAuth.ts` (Bearer token, API Key) y **Azure Active Directory** via `DefaultAzureCredential` del SDK `@azure/identity` (cuando `autorizacion` es una URL de scope de Azure).
- Un archivo de spec con steps para ejecutar y consultar queries en la BD Oracle.
- Un archivo de spec con steps para ejecutar los diferentes métodos de API.
- Configuración para ejecutar pruebas de rendimiento (carga baja, media, alta, estrés y resistencia) con k6, reutilizando los mismos archivos de data y schema de las pruebas de API.
- Pre-inyección automática del token de Azure AD antes de iniciar k6 cuando el escenario usa autenticación OAuth2.
- Un archivo para gestionar las variables de entorno (`.env.dev`, `.env.qa`, `.env.prod`).
- Adjunto automático de `dataJson` y `dataApiResponse` al reporte HTML de Playwright al finalizar cada test.
- Ejecución nativa en paralelo y configuración multiplataforma desde `playwright.config.ts`.
- Integración con pipelines CI/CD en **GitHub Actions** y **Azure DevOps**.

----

### Contenido

- [Prerequisitos](#prerequisitos)
- [Instalacion](#instalación)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso](#uso)
- [Ejecución](#ejecución)
- [Contribución](#contribución)
- [Recomendación de Extensiones para VSC](#recomendación-de-extensiones-para-vscode)

----

### Prerequisitos

1. Instalar **[Node.js](https://nodejs.org/en)** (v24.x LTS o superior)
2. Instalar **[Visual studio Code](https://code.visualstudio.com/download)** (Ultima versión recomendada)
3. Instalar la extensión de Playwright para Visual Studio Code:  **[Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)**
4. Instalar **[K6](https://grafana.com/docs/k6/latest/set-up/install-k6/)** (el script `postinstall` intenta instalarlo automáticamente vía Chocolatey en Windows; en otros sistemas operativos puede requerir instalación manual):
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

----

### Instalación

1. Clonar el repositorio desde la consola en la ruta donde desea trabajar el proyecto:

```bash
git clone <Link_del_repositorio>
```

2. Instalar las dependencias (instala también Playwright browsers y k6 automáticamente vía `postinstall`):

```bash
npm install
```

> **NOTA:** El script `postinstall` ejecuta `install:k6` (detecta el SO e instala k6 si no está presente) e `install:playwright` (instala los navegadores de Playwright con sus dependencias del sistema).

----

### Estructura del Proyecto

```plaintext
├── .github/
│   └── workflows/
│       └── gitHubPipeline.yml              # Pipeline CI/CD de GitHub Actions
├── .vscode/
│   ├── extensions.json                     # Extensiones recomendadas para el equipo
│   └── settings.json                       # Configuración del editor para el proyecto
├── apiToUpdateTestCase/
│   ├── Azure-Devops.postman_collection.json        # Colección Postman para gestión de casos en Azure DevOps
│   └── Azure-devops-test.postman_environment.json  # Variables de entorno Postman para Azure DevOps
├── azurePipelineFormat/
│   └── azure-pipelines.yml                 # Pipeline CI/CD de Azure DevOps
├── logs/
│   └── .gitkeep                            # Mantiene el directorio en git; los logs se generan en ejecución
├── src/
│   ├── config/
│   │   ├── API/
│   │   │   ├── apiAuth.ts                  # Credenciales estáticas y autenticación Azure AD (DefaultAzureCredential)
│   │   │   ├── apiConfig.ts                # Cliente HTTP (GET, POST, PUT, PATCH, DELETE) con soporte de números grandes
│   │   │   ├── apiSchemaValidator.ts       # Validación AJV + ajv-formats sobre archivos JSON Schema
│   │   │   └── apiServices.ts              # Orquestador de requests: resolución de auth, headers y logging
│   │   ├── DB/
│   │   │   ├── DBConnectionConfig.ts       # Registro de credenciales por base de datos y usuario
│   │   │   ├── oracleConfig.ts             # Clase OracleDB: conexión, ejecución de queries y cierre
│   │   │   └── oracleService.ts            # Servicio de alto nivel para ejecutar queries Oracle
│   │   ├── fixtures/
│   │   │   ├── api.fixture.ts              # Fixture que provee ApiService
│   │   │   ├── database.fixture.ts         # Fixture que provee DatabaseService y cierra la conexión al finalizar
│   │   │   ├── index.ts                    # Punto de entrada: combina fixtures y captura errores de consola
│   │   │   ├── pom.fixture.ts              # Fixture que provee instancias de los POMs registrados
│   │   │   └── worldData.fixture.ts        # Contexto compartido: dataJson, dataquery, dataApiResponse
│   │   ├── performance/
│   │   │   ├── loadData.ts                 # Carga escenario y schema desde los JSON compartidos con Playwright
│   │   │   ├── replacePlaceHoldersPerf.ts  # Resuelve marcadores %VARIABLE% con valores de __ENV en k6
│   │   │   ├── requestHandler.ts           # Envía el request HTTP en k6 y valida status code y schema
│   │   │   ├── scenarioConfig.ts           # Genera opciones k6: perfiles de carga y thresholds
│   │   │   └── validator.ts                # Validador de JSON Schema nativo para k6 (mirror de AJV)
│   │   ├── CustomReporter.ts               # Reporter personalizado: registra feature, scenario y steps en el log
│   │   └── logConfig.ts                    # Clase Logs: archivo por ejecución, colores ANSI y cabecera
│   ├── test/
│   │   ├── data/
│   │   │   ├── API/
│   │   │   │   ├── schemas/
│   │   │   │   │   └── apiExampleSchemas.json      # JSON Schemas para validación de responses por escenario
│   │   │   │   └── apiExample.json                 # Escenarios de API: método, URL, headers, auth, payload
│   │   │   ├── portal/
│   │   │   │   └── consultaRnc.json                # Datos de prueba para el módulo de consulta RNC
│   │   │   └── pruebaEjecucionQuery.json            # Datos para pruebas de base de datos Oracle
│   │   ├── flows/
│   │   │   ├── API/
│   │   │   │   └── ejecucionAPI.flow.ts             # Ejecuta el request y valida el schema de respuesta
│   │   │   └── portal/
│   │   │       └── consultaRNC.flow.ts              # Navegación por menú y búsqueda por RNC
│   │   ├── performance/
│   │   │   └── performanceTest.ts                   # Entry point de k6: carga escenario, opciones y ejecuta requests
│   │   ├── pom/
│   │   │   └── portal/
│   │   │       └── consultaRNC.ts                   # Page Object Model: selectores y acciones de la página RNC
│   │   └── specs/
│   │       ├── API/
│   │       │   └── ejecucionApi.spec.ts             # Spec de API: genera un test por cada escenario del JSON
│   │       ├── DataBase/
│   │       │   └── ejecucionOracle.spec.ts          # Spec de BD: ejecuta queries Oracle y valida resultados
│   │       └── portal/
│   │           ├── accederDGII.spec.ts              # Spec de UI: pruebas de acceso al portal DGII
│   │           └── consultaRNC.spec.ts              # Spec de UI: pruebas de consulta de RNC
│   └── utilidades/
│       └── playwright-utilidades.ts                 # Funciones compartidas: replacePlaceholders, isValidUrl, obtenerVariablesVacias
├── .env.dev                                         # Variables de ambiente para desarrollo
├── .env.qa                                          # Variables de ambiente para QA
├── .env.prod                                        # Variables de ambiente para producción
├── .gitignore
├── Docker_Command.txt                               # Referencia rápida de comandos Docker
├── ejecucionPerformance.ts                          # Runner k6: carga env, inyecta token Azure y ejecuta k6
├── instalarK6.ts                                    # Instalación automática de k6 multiplataforma (win/mac/linux)
├── package.json                                     # Dependencias, scripts npm y metadatos del proyecto
├── package-lock.json                                # Lockfile de dependencias
├── playwright.config.ts                             # Configuración de Playwright: proyectos, reportes y timeouts
├── runner.ts                                        # Runner Playwright: parsea args, nombra log/reporte e invoca npx
├── tsconfig.json                                    # TypeScript para Playwright y Node.js (CommonJS)
└── tsconfig.k6.json                                 # TypeScript para módulos k6 (ESNext/bundler, noEmit)
```

----

### Uso

#### 1. Pruebas de UI (Navegador)

1. Crear el archivo `.spec.ts` con los casos de prueba en **`src/test/specs/<sistema>/`**. [Ver ejemplo](src/test/specs/portal/consultaRNC.spec.ts)

2. Crear el archivo `.json` con los datos de prueba en **`src/test/data/<sistema>/`**. [Ver ejemplo](src/test/data/portal/consultaRnc.json)

3. Crear el archivo del POM con los elementos web en **`src/test/pom/<sistema>/`**. [Ver ejemplo](src/test/pom/portal/consultaRNC.ts)

4. Crear el archivo de flow con la lógica de negocio en **`src/test/flows/<sistema>/`**. [Ver ejemplo](src/test/flows/portal/consultaRNC.flow.ts)

5. Registrar el POM en **`src/config/fixtures/pom.fixture.ts`** para poder inyectarlo en los specs vía fixture. [Ver ejemplo](src\config\fixtures\pom.fixture.ts)

6. Actualizar cada archivo `.env` con las variables necesarias para cada ambiente.

#### 2. Pruebas de Base de Datos (Oracle)

Revisar que las credenciales existan en **[DBConnectionConfig](src/config/DB/DBConnectionConfig.ts)** y que sus valores estén en los archivos `.env`. Luego agregar el caso de prueba al spec correspondiente. [Ver ejemplo](src/test/specs/DataBase/ejecucionOracle.spec.ts)

El contexto **`WorldData`** expone las siguientes funciones para acceder al resultado del query:

| Función | Descripción |
|---|---|
| `obtenerDataQuery()` | Retorna el array completo de filas del resultado del query |
| `obtenerCeldaQuery(columna, fila)` | Retorna el valor de una columna específica en una fila específica (índice desde 1) |

#### 3. Pruebas de API

1. Crear el archivo `.json` de data en **`src/test/data/API/`** con la estructura de escenario. [Ver ejemplo](src/test/data/API/apiExample.json)

2. Si se requiere validación de schema, agregar el schema JSON en **`src/test/data/API/schemas/`** con una clave por escenario. [Ver ejemplo](src/test/data/API/schemas/apiExampleSchemas.json)

3. Referenciar el archivo desde el spec usando la constante `DATA_FILE`. El spec itera automáticamente sobre todas las claves del JSON, generando un test por escenario sin código adicional. [Ver ejemplo](src/test/specs/API/ejecucionApi.spec.ts)

La función **`obtenerDataApiResponse(key)`** dentro del contexto **`worldData`** permite acceder al response:

| Uso | Descripción |
|---|---|
| `obtenerDataApiResponse(campo)` | Un campo específico del response |
| `obtenerDataApiResponse()` | Response completo serializado como JSON string |

##### Estructura del archivo JSON de escenarios de API

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
    "transacciones": 400
  }
}
```

> **NOTA:** El campo `autorizacion` acepta dos formas:
> - Nombre de clave definida en `apiAuth.ts` (ej: `"bearerToken"`, `"apiKeyDev"`) → usa credenciales estáticas.
> - URL completa de scope de Azure AD (ej: `"https://..."`) → obtiene token via `DefaultAzureCredential` (identidad administrada en pipelines, `az login` en local).

##### Sistema de placeholders

Los valores en los archivos JSON pueden contener marcadores con el formato `%NOMBRE_VARIABLE%`. Estos se resuelven automáticamente:
- En Playwright: desde `process.env` al cargar la data con `cargarDataFeature`.
- En k6: desde `__ENV` al cargar el escenario con `cargarEscenario`.

```json
{ "urlBase": "%API_PET_BASE_URL%" }
```

#### 4. Pruebas de Performance (k6)

Los archivos de data de API (`src/test/data/API/`) son compartidos entre Playwright y k6. No se necesita crear archivos separados.

1. Verificar que el escenario a probar exista en el archivo JSON de data y que tenga definido `schemaRef` y `transacciones` si aplica. [Ver ejemplo](src/test/data/API/apiExample.json)

2. Si deseas validar el schema del response, asegurarse de que el JSON Schema exista en `src/test/data/API/schemas/` con la misma clave del escenario.

3. Ejecutar la prueba indicando el archivo, el escenario y el ambiente. [Ver sección Ejecución](#ejecución)

##### Perfiles de carga disponibles

Los perfiles se calculan dinámicamente a partir del valor `transacciones` del escenario (transacciones por minuto en carga alta):

| Perfil | TPS configurado | Duración |
|---|---|---|
| `low` (activo por defecto) | 1% de `transacciones` | 1 min |
| `medium` | 50% de `transacciones` | 30 min |
| `high` | 100% de `transacciones` | 60 min |
| `stress` | 200% de `transacciones` | 60 min |
| `endurance` | 150% de `transacciones` | 12 h |

> Para activar múltiples perfiles simultáneamente, descomentar la línea `scenarios: allProfiles` en [scenarioConfig.ts](src/config/performance/scenarioConfig.ts).

##### Thresholds configurados

| Métrica | Umbral |
|---|---|
| `http_req_duration` p(90) | < 500 ms |
| `http_req_duration` p(99) | < 1200 ms |
| `http_req_failed` | < 1% |
| `checks` (general) | > 99% |
| `checks` "Validar status code" | > 99% |

----

### Ejecución

#### Pruebas de UI y API (Playwright)

Las pruebas se pueden ejecutar por navegador, por feature o por tag:

**Microsoft Edge:**
```bash
npm run edge folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

**Chrome:**
```bash
npm run chrome folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

**Firefox:**
```bash
npm run firefox folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

**Safari:**
```bash
npm run safari folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

**APIs (sin navegador):**
```bash
npm run api folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

> **NOTA:** Los parámetros `folder`, `feature`, `tags` y `workers` son opcionales. Si se omiten, se ejecutan todos los casos del ambiente indicado con un worker. En CI se fuerza `headless: true` y se usan 2 workers por defecto.

**UI Interactivo de Playwright:**
```bash
npm run test:ui
```

#### Pruebas de Performance (k6)

```bash
npm run perf env=<dev/qa/prod> data_file=<nombre-archivo> scenario=<clave-escenario>
```

**Ejemplo:**
```bash
npm run perf env=dev data_file=apiExample scenario=escenario3
```

> **NOTA:** `data_file` hace referencia a un archivo dentro de `src/test/data/API/` (sin extensión). `scenario` es la clave del escenario dentro de ese archivo. Si el escenario usa autenticación Azure AD, el runner obtiene el token antes de iniciar k6 y lo inyecta via la variable de entorno `AZURE_TOKEN`. Ambos parámetros son requeridos para una ejecución controlada; si se omiten, k6 fallará al intentar cargar el escenario.

El reporte HTML del dashboard de k6 se genera automáticamente en `reports/K6-report/performance_dashboard_<data_file>_<timestamp>.html`.

#### Variables de entorno requeridas

Cada archivo `.env.<ambiente>` debe contener las variables usadas como placeholders en los JSONs de datos y las credenciales de BD:

| Variable | Descripción |
|---|---|
| `API_QA_BEARER_TOKEN` | Token Bearer estático para autenticación de API |
| `API_Key_DEV` | API Key para autenticación en ambiente de desarrollo |
| `API_PET_BASE_URL` | URL base de ejemplo para la API de pruebas |
| `DB_CADENA_QASB` | Connection string Oracle para BD `QASB` |
| `DB_PASSWORD_QASB_USER` | Password Oracle para usuario `USER` en `QASB` |
| `DB_CADENA_QADB01` | Connection string Oracle para BD `qadb01` |
| `DB_PASSWORD_QADB01_USER` | Password Oracle para usuario `USER` en `qadb01` |

#### Reportes generados

| Reporte | Ruta | Descripción |
|---|---|---|
| HTML Playwright | `reports/playwright-report/<nombre-ejecucion>/` | Reporte interactivo con capturas, videos y datos adjuntos |
| JUnit XML | `reports/temp/xml/results.xml` | Resultados para integración con Azure DevOps / GitHub Actions |
| JSON | `reports/temp/json/results.json` | Resultados en formato JSON |
| Dashboard k6 | `reports/K6-report/performance_dashboard_*.html` | Dashboard exportado de k6 Web Dashboard |
| Logs | `logs/<nombre-ejecucion>-logs.txt` | Log de texto por ejecución con steps, errores y parámetros |

----

### Integración CI/CD

#### GitHub Actions (`gitHubPipeline.yml`)

- **Triggers**: push/PR a `main`/`master` y ejecución manual (`workflow_dispatch`).
- **Parámetros manuales**: `browser`, `folder`, `feature`, `tags`, `env`, `workers`. Incluye la opción `perf` para pruebas de rendimiento.
- **Agente**: `windows-latest` (hosted).
- **Node.js**: versión LTS más reciente (`lts/*`).
- **Artefactos publicados**: reportes HTML de Playwright (`reports/playwright-report/`), dashboard k6 (`reports/K6-report/`) y logs (`logs/`), con retención de 30 días.
- **Publicación JUnit**: via `dorny/test-reporter@v1` (omitido si `browser=perf`).

#### Azure DevOps (`azure-pipelines.yml`)

- **Triggers**: push/PR a `main`/`master`.
- **Parámetros manuales**: `browser`, `folder`, `feature`, `tags`, `env`, `paralelo`.
- **Agente**: on-premise (`poolName: onpremise`), pool configurable para Windows/macOS en paralelo.
- **Node.js**: `>=20.x`.
- **Grupo de variables**: `ConexionBD` (credenciales Oracle mapeadas a variables de entorno en el step de ejecución).
- **Reintentos automáticos**: `retryCountOnTaskFailure: 2` en el step de ejecución.
- **Artefactos publicados**: reportes HTML y logs como `PipelineArtifact`; resultados JUnit via `PublishTestResults@2`.

----

### Contribución

Para subir los cambios al repositorio favor tomar en cuenta:

1. Realizar los cambios y pruebas en una nueva rama.
2. Asegurar que el código cumple con la estructura establecida.
3. Realizar pruebas locales para validar que el código funciona correctamente.
4. Actualizar el yaml del pipeline si es necesario.
5. Enviar un pull request detallando los cambios.

### Recomendación de Extensiones para VSCode

Para una mejor experiencia de desarrollo, se recomienda instalar las siguientes extensiones en Visual Studio Code:

1. **Azure Git Repos**: `ms-vscode.azure-repos`
2. **IntelliCode**: `VisualStudioExptTeam.vscodeintellicode`
3. **Material Icon Theme**: `material-icon-theme.material-icon-theme`
4. **Playwright Code Snippets**: `playwright.playwright-code-snippets`
5. **Playwright Snippets**: `playwright.playwright-snippets`
6. **Playwright Test for VSCode**: `ms-playwright.playwright`
7. **Playwright Test Runner**: `playwright.playwright-test-runner`

Puedes instalar estas extensiones fácilmente abriendo el proyecto en Visual Studio Code. VSCode te notificará sobre las extensiones recomendadas y te dará la opción de instalarlas.
