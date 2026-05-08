
# Framework de Automatización con Playwright, K6 y TypeScript

----

### Descripción

Framework para la automatización de pruebas funcionales, de API, de base de datos y de rendimiento, construido con Playwright y TypeScript. Incluye las siguientes funcionalidades:

- Generación de logs.
- Posibilidad de utilizar la extensión de Playwright para grabar scripts y reutilizarlos en el framework.
- Fixtures centralizadas en `src/config/fixtures/` para administrar contextos e inyección de dependencias por tipo de prueba (UI, API, BD).
- Patrón de diseño **Flow + POM (Page Object Model)** para separar la lógica de negocio de la interacción con la UI.
- Uso de datos de prueba desde archivos JSON compartidos entre pruebas Playwright y k6.
- Validación de schemas de respuestas de API con **AJV** (Playwright) y un validador JSON Schema equivalente para k6, usando los mismos archivos de schema.
- Un archivo de spec con steps para ejecutar y consultar queries en la BD Oracle.
- Un archivo de spec con steps para ejecutar los diferentes métodos de API.
- Configuración para ejecutar pruebas de rendimiento (carga baja, media, alta, estrés y resistencia) con k6, reutilizando los mismos archivos de data y schema de las pruebas de API.
- Un archivo para gestionar las variables de entorno (`.env.dev`, `.env.qa`, `.env.prod`).
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

1. Instalar **[Node.js](https://nodejs.org/en)** (v24.x o superior)
2. Instalar **[Visual studio Code](https://code.visualstudio.com/download)** (Ultima versión recomendada)
3. Instalar la extensión de Playwright para Visual Studio Code:  **[Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)**
4. Instalar **[K6](https://grafana.com/docs/k6/latest/set-up/install-k6/)**:
```bash
choco install k6
winget install k6 --source winget
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

----

### Estructura del Proyecto

```plaintext
├── .github/
│   └── workflows/
│       └── gitHubPipeline.yml      # Pipeline de GitHub Actions
├── .vscode/                        # Sugerencias de extensiones y configuración del editor
├── azurePipelineFormat/
│   └── azure-pipelines.yml         # Pipeline de Azure DevOps
├── logs/                           # Archivos de logs generados en ejecución
├── node_modules/                   # Dependencias de npm
├── reports/                        # Reportes generados (HTML, JUnit, k6 dashboard)
├── src/
│   ├── config/                     # Configuraciones y servicios reutilizables
│   │   ├── API/                    # Cliente HTTP, autenticación y validación de schema
│   │   │   ├── apiAuth.ts
│   │   │   ├── apiConfig.ts
│   │   │   ├── apiSchemaValidator.ts
│   │   │   └── apiServices.ts
│   │   ├── DB/                     # Configuración y servicio de conexión Oracle
│   │   │   ├── DBConnectionConfig.ts
│   │   │   ├── oracleConfig.ts
│   │   │   └── oracleService.ts
│   │   ├── fixtures/               # Fixtures de Playwright con inyección de dependencias
│   │   │   ├── index.ts            # Punto de entrada; combina todos los fixtures
│   │   │   ├── api.fixture.ts
│   │   │   ├── database.fixture.ts
│   │   │   ├── pom.fixture.ts
│   │   │   └── worldData.fixture.ts
│   │   ├── performance/            # Módulos k6 (carga de data, validación, configuración)
│   │   │   ├── loadData.ts
│   │   │   ├── replacePlaceHoldersPerf.ts
│   │   │   ├── requestHandler.ts
│   │   │   ├── scenarioConfig.ts
│   │   │   └── validator.ts
│   │   ├── CustomReporter.ts       # Reporter personalizado para Playwright
│   │   └── logConfig.ts
│   ├── test/
│   │   ├── data/                   # Datos de prueba JSON (compartidos entre Playwright y k6)
│   │   │   ├── API/
│   │   │   │   ├── apiExample.json         # Escenarios de API (metodo, url, payload, etc.)
│   │   │   │   └── schemas/
│   │   │   │       └── apiExampleSchemas.json  # JSON Schemas para validación de response
│   │   │   └── portal/
│   │   │       └── consultaRnc.json
│   │   ├── flows/                  # Lógica de negocio reutilizable por los specs
│   │   │   ├── API/
│   │   │   │   └── ejecucionAPI.flow.ts
│   │   │   └── portal/
│   │   │       └── consultaRNC.flow.ts
│   │   ├── performance/
│   │   │   └── performanceTest.ts  # Script principal de k6
│   │   ├── pom/                    # Page Object Models (elementos UI por página)
│   │   │   └── portal/
│   │   │       └── consultaRNC.ts
│   │   └── specs/                  # Specs de prueba de Playwright
│   │       ├── API/
│   │       │   └── ejecucionApi.spec.ts
│   │       ├── DataBase/
│   │       │   └── ejecucionOracle.spec.ts
│   │       └── portal/
│   │           ├── accederDGII.spec.ts
│   │           └── consultaRNC.spec.ts
│   └── utilidades/
│       └── playwright-utilidades.ts
├── .env.dev                        # Variables de ambiente desarrollo
├── .env.qa                         # Variables de ambiente QA
├── .env.prod                       # Variables de ambiente producción
├── .gitignore
├── ejecucionPerformance.ts         # Runner de pruebas k6
├── instalarK6.ts                   # Script de instalación automática de k6
├── package.json
├── package-lock.json
├── playwright.config.ts            # Configuración de Playwright (browsers, reportes, timeouts)
├── README.md
├── runner.ts                       # Runner principal de Playwright
├── tsconfig.json                   # Configuración TypeScript para Playwright y Node.js
└── tsconfig.k6.json                # Configuración TypeScript para los módulos k6
```

----

### Uso

#### 1. Pruebas de UI (Navegador)

1. Crear el archivo `.spec.ts` con los casos de prueba en **`src/test/specs/<sistema>/`**. [Ver ejemplo](src/test/specs/portal/consultaRNC.spec.ts)

2. Crear el archivo `.json` con los datos de prueba en **`src/test/data/<sistema>/`**. [Ver ejemplo](src/test/data/portal/consultaRnc.json)

3. Crear el archivo del POM con los elementos web en **`src/test/pom/<sistema>/`**. [Ver ejemplo](src/test/pom/portal/consultaRNC.ts)

4. Crear el archivo de flow con la lógica de negocio en **`src/test/flows/<sistema>/`**. [Ver ejemplo](src/test/flows/portal/consultaRNC.flow.ts)

5. Actualizar cada archivo `.env` con las variables necesarias para cada ambiente.

#### 2. Pruebas de Base de Datos (Oracle)

Revisar que las credenciales existan en **[DBConnectionConfig](src/config/DB/DBConnectionConfig.ts)** y que sus valores estén en los archivos `.env`. Luego agregar el caso de prueba al spec correspondiente. [Ver ejemplo](src/test/specs/DataBase/ejecucionOracle.spec.ts)

El contexto **`WorldData`** expone dos funciones para acceder al resultado del query:

| Función | Descripción |
|---|---|
| `obtenerDataQuery()` | Retorna el array completo de filas del resultado del query |
| `obtenerCeldaQuery(columna, fila)` | Retorna el valor de una columna específica en una fila específica (índice desde 1) |

#### 3. Pruebas de API

1. Crear o actualizar el archivo `.json` de data en **`src/test/data/API/`** con la estructura de escenario. [Ver ejemplo](src/test/data/API/apiExample.json)

2. Si se requiere validación de schema, agregar el schema JSON en **`src/test/data/API/schemas/`** con una clave por escenario. [Ver ejemplo](src/test/data/API/schemas/apiExampleSchemas.json)

3. Referenciar el archivo desde el spec usando la constante `DATA_FILE`. [Ver ejemplo](src/test/specs/API/ejecucionApi.spec.ts)

La función **`obtenerDataApiResponse(key)`** dentro del contexto **`worldData`** permite acceder al response:

| Uso | Descripción |
|---|---|
| `obtenerDataApiResponse(campo)` | Un campo específico del response |
| `obtenerDataApiResponse()` | Response completo |

#### 4. Pruebas de Performance (k6)

Los archivos de data de API (`src/test/data/API/`) son compartidos entre Playwright y k6. No se necesita crear archivos separados.

1. Verificar que el escenario a probar exista en el archivo JSON de data y que tenga definido `schemaRef` y `transacciones` si aplica. [Ver ejemplo](src/test/data/API/apiExample.json)

2. Si deseas validar el schema del response, asegurarse de que el JSON Schema exista en `src/test/data/API/schemas/` con la misma clave del escenario.

3. Ejecutar la prueba indicando el archivo, el escenario y el ambiente. [Ver sección Ejecución](#ejecución)

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

> **NOTA:** Los parámetros `folder`, `feature`, `tags` y `workers` son opcionales. Si se omiten, se ejecutan todos los casos del ambiente indicado.

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

> **NOTA:** `data_file` hace referencia a un archivo dentro de `src/test/data/API/` (sin extensión). `scenario` es la clave del escenario dentro de ese archivo. Ambos parámetros son opcionales; si se omiten, se usan los valores por defecto definidos en `performanceTest.ts`.

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
