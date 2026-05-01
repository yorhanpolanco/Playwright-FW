
# README

## Framework de Playwright con BDD y TypeScript

----

### Descripción

Este es un framework para la automatización de casos de prueba que implementa Playwright, BDD, k6 y TypeScript. Se han agregado varias funcionalidades adicionales, tales como:

- Generación de logs.
- Posibilidad de utilizar la extensión de Playwright para grabar scripts y reutilizarlos en el framework.
- Soporte nativo de `playwright-bdd` combinando la sintaxis Gherkin de Cucumber con el motor veloz de Playwright.
- Fixtures centralizadas en `src/config/fixtures.ts` para administrar funciones, contextos e inyección de dependencias.
- Uso de datos de prueba desde un archivo JSON.
- Implementación del patrón de diseño POM (Page Object Model).
- Un archivo para gestionar las variables de entorno (`.env.dev`, `.env.qa`, etc.).
- Ejecución nativa en paralelo y configuración multiplataforma nativa desde `playwright.config.ts`.
- Un archivo feature con steps para ejecutar y consultar queries en la BD
- Un archivo feature con steps para ejecutar los diferentes metodos de la APIs proporcionadas
- Configuración para ejecutar pruebas de carga baja, media, alta, estres y resistencia solo agregando un archivo de data.

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

1. Instalar **[Node.js](https://nodejs.org/en)** (v20.14.0 o superior)
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

2. Instalar las dependencias:

```bash
npm install
```

----

### Estructura del Proyecto

```plaintext
├── .vscode/                    # Archivo con sugerencia de extensiones y configuración para las mismas
├── logs/                       # Archivo de logs          
├── node_modules/               # Dependencias de npm
├── src/                        # Código fuente de las pruebas
│   ├── config/                 # Directorio de archivos de configuracion
│   │    ├── API/               # Directorio con archivos de configuracion y ejecucion de request a APIs
│   │    ├── BD/                # Directorio con archivos de configuracion de la conexion y ejecucion de script en la BD
│   │    ├── fixtures.ts        # Archivo principal de Fixtures integradas para inyección de dependencias
│   │    └── performance        # Directorio con archivos de configuracion para las pruebas de performance 
│   ├── test/                   # Directorio de los scenarios de pruebas y los steps
│   │    ├── data/              # Directorio de la data de pruebas
│   │    ├── features/          # Archivos .feature de Cucumber
│   │    ├── pom/               # Directorio de los POMs (Page Object Model)  
│   │    └── step/              # Definiciones de pasos de Cucumber
│   ├── test-result/            # Directorio de data de los reportes
│   │    ├── reports/           # Directorio de reportes de cucumber
│   │    └── screenshots/       # Directorio de capturas de pantalla temporales
│   └── utilidades              # Configuraciones y utilidades
├── .env.dev                    # Archivo de variables de ambiente dev
├── .env.prod                   # Archivo de variables de ambiente produccion
├── .env.qa                     # Archivo de variables de ambiente qa
├── .gitignore                  # Archivos y directorios a ignorar por git
├── azure-pipelines.yml         # Archivo de configuracion de pipeline
├── ejecucionPerformance.js     # Archivo de script para la ejecución de performance
├── package-lock.json           # Archivo automatico de dependencias
├── package.json                # Archivo de configuracion de dependencias y scripts de npm
├── playwright.config.ts        # Configuración de Playwright (Browsers, Reportes, Variables)
├── README.md                   # Este archivo
└── tsconfig.json               # Configuración de TypeScript
```

----

### Uso

1. Crear el archivo .feature con los escenarios de prueba outline en el directorio **`src/test/features/<sistema_automatizado>/`**. [Ver ejemplo](src/test/features/portal/consultaRNC.feature)

2. Crear el archivo .json con los datos de prueba en el directorio **`src/test/data/`**. [Ver ejemplo](src/test/data/consultaRnc.json)

3. Crear el archivo .ts del pom con todos los elementos web de los escenarios **`src/test/pom/`**. [Ver ejemplo](src/test/pom/consultaRNC.ts)

4. Actualizar cada archivo .env con la data necesaria de cada ambiente de prueba

5. Crear el archivo .steps.ts con los pasos de los escenarios del archivo feature **`src/test/steps/<sistema_automatizado>/`**. [Ver ejemplo](src/test/steps/portal/consultaRNC.steps.ts)

6. Para ejecutar queries se debe revisar si las credenciales existen en **[DBConnectionConfig](src/config/DB/DBConnectionConfig.ts)** y los valores de ellas en los archivos .env. Luego solo se necesita agregar el paso **"Ejecutar "<consulta>" Oracle en "<BD>" usuario "<user>""** en tu archivo de feature y pasarle el query, la BD donde se ejecutará y el usuario que la ejecutará. [Ver ejemplo1](src/test/features/portal/AccederDGII.feature) [Ver ejemplo2](src/test/features/DataBase/ejecucionOracle.feature)

    6.1 Fue creada la funcion **obtenerDataQuery( key, fila )** dentro del contexto **CustomWorldImpl** con esta función puedes obtener el resultado del query ejecutandolo en los siguientes formatos:
    * Un campo en especifico ----> obtenerDataQuery(campo,1)
    * La lista completa de un campo ----> obtenerDataQuery(campo)
    * Query completo ----> obtenerDataQuery()
    * Retorna el registro en la posición 5 ----> obtenerDataQuery(5)
    Ejemplos:
    [Ejemplo1](src/test/features/DataBase/ejecucionOracle.feature) [Ejemplo2](src/test/features/portal/AccederDGII.feature)
       

7. Para ejecutar request a APIs se debe revisar si las credenciales autorizacion existen en **[apiAuth](src/config/API/apiAuth.ts)** y los valores de ellas en los archivos .env. Luego solo se necesita agregar el paso **"Ejecutar metodo "<metodo>" en "<url>""<endpoint>" con "<header>", autorizacion "<auth>" y data "<data>" "**  en tu archivo de feature y pasarle el metodo que deseas utilizar **"GET, POST, PUT, PATCH, DELETE"** , la url base del API, el endpoint, el header, la autorizacion y la data si aplica.[Ver ejemplo](src/test/features/API/ejecucionApi.feature)

    7.1 Fue creada la funcion **obtenerDataApiResponse( key )** dentro del contexto inyectado de **worldData** con esta función puedes obtener el response del request realizado a una API ejecutándolo en los siguientes formatos:
    * Un campo en especifico ----> obtenerDataApiResponse(campo)
    * Response completo ----> obtenerDataApiResponse()
    Ejemplo: [Ejemplo1](src/test/features/API/ejecucionApi.feature)

8. Para ejecutar pruebas de performance solo se necesita crear el archivo con la data necesaria en el directorio **`src/test/data/performanceData`**. [Ver ejemplo](src/test/data/performanceData/rba.json)

----

### Ejecución

#### Ejecución Estándar (Playwright BDD)

Para ejecutar las pruebas en Playwright BDD (que ahora soporta auto-generación de tests desde steps):

1. **Ejecución en un navegador específico:**

Las pruebas de APIs y navegadores específicos o de todos los navegadores a la vez se pueden ejecutar con los siguientes comandos:

1.1 **Ejecución en Microsoft Edge:**

```bash
npm run edge folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<prod/qa> workers=<numero>
```

1.2 **Ejecución en Chrome:**

```bash

npm run chrome folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<prod/qa> workers=<numero>
```

1.3 **Ejecución en Safari:**

```bash
npm run safari folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<prod/qa> workers=<numero>
```

1.4 **Ejecución en todos los navegadores:**

```bash
npm run test folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

1.5 **Ejecución de APIs:**
  
```bash
npm run api folder=<folder> feature=<nombre-feature> tags=@<nombre-tag> env=<dev/qa/prod> workers=<numero>
```

> **!NOTA:**
> Los parámetros como folder, feature, tags y workers no son obligatorios. Sin embargo, si deseas ejecutar algún elemento específico, puedes especificarlo directamente.

2. **Ejecución abriendo el UI Interactivo de Playwright:**

```bash
npm run test:ui
```

3. **Ejecución de pruebas de performance (k6):**

```bash
npm run perf -- env=<dev/qa/prod> data_file=<nombre-archivo>
```

----

### Contribución

Para subir los cambios al repositorio favor tomar en cuenta:

1. Realizar los cambios y pruebas en una nueva rama.
2. Asegurar que el código cumple con la estructura establecida.
3. Realizar pruebas locales para validar que el codigo funciona correctamente
4. Actualizar el yaml del pipeline si es necesario
5. Enviar un pull request detallando los cambios.

### Recomendación de Extensiones para VSCode

Para una mejor experiencia de desarrollo, se recomienda instalar las siguientes extensiones en Visual Studio Code:

1. **Azure Git Repost**: `ms-vscode.azure-repos`
2. **Cucumber**: `cucumber.cucumber`
3. **IntelliCode**: `VisualStudioExptTeam.vscodeintellicode`
4. **Material Icon Theme**: `material-icon-theme.material-icon-theme`
5. **Playwright Code Snippets**: `playwright.playwright-code-snippets`
6. **Playwright Snippets**: `playwright.playwright-snippets`
7. **Playwright Test for VSCode**: `playwright.playwright-test-for-vscode`
8. **Playwright Test Runner**: `playwright.playwright-test-runner`

Puedes instalar estas extensiones fácilmente abriendo el proyecto en Visual Studio Code. VSCode te notificará sobre las extensiones recomendadas y te dará la opción de instalarlas.