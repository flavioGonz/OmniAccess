# Documentación de `importar_datos.php`

## Descripción General

`importar_datos.php` es una interfaz de usuario web que facilita la importación masiva de datos de propietarios y vehículos desde un archivo CSV. El proceso se divide en tres pasos interactivos: subir el archivo, mapear las columnas del CSV a los campos de la base de datos, y monitorizar el progreso de la importación.

## Flujo de Operación

### Interfaz de Usuario (HTML/CSS/JavaScript)

La página guía al usuario a través de un proceso de tres pasos:

1.  **Paso 1: Subir Archivo CSV (`upload-step`)**
    *   El usuario selecciona un archivo CSV desde su sistema.
    *   Al hacer clic en "Previsualizar y Mapear Columnas", el formulario envía el archivo a `process_csv.php?action=preview`.
    *   Si la previsualización es exitosa, este paso se oculta y se muestra el siguiente.

2.  **Paso 2: Mapear Columnas (`mapping-step`)**
    *   Se muestra una lista de las cabeceras detectadas en el CSV.
    *   El usuario debe seleccionar qué columna corresponde a la "Matrícula" y cuál al "Nombre del Propietario" utilizando menús desplegables.
    *   Al hacer clic en "Iniciar Importación", el formulario envía los datos de mapeo y la ruta del archivo temporal a `process_csv.php?action=import`.
    *   Este paso se oculta y se muestra el paso de progreso.

3.  **Paso 3: Progreso y Resultado (`progress-step`)**
    *   Muestra una barra de progreso que se actualiza en tiempo real.
    *   Muestra un mensaje de estado indicando la línea que se está procesando.
    *   Una vez completada la importación, muestra un resumen detallado de la operación (líneas procesadas, propietarios creados, vehículos creados/actualizados).

### Backend (Interacción con `process_csv.php` y `progress.php`)

*   **`process_csv.php?action=preview`:**
    *   Recibe el archivo CSV subido.
    *   Lee las primeras líneas para extraer las cabeceras.
    *   Guarda el archivo CSV temporalmente en el servidor.
    *   Devuelve las cabeceras y la ruta del archivo temporal al frontend.

*   **`process_csv.php?action=import`:**
    *   Recibe la ruta del archivo CSV temporal y el mapeo de columnas.
    *   Inicia el proceso de importación en segundo plano (o de forma asíncrona).
    *   Durante la importación, actualiza un archivo de progreso (o una variable de sesión) que `progress.php` puede leer.

*   **`progress.php`:**
    *   Es un endpoint AJAX que el frontend consulta periódicamente (`monitorProgress()`).
    *   Lee el estado actual del proceso de importación (líneas procesadas, total de líneas, resumen) y lo devuelve en formato JSON.
    *   Permite que la barra de progreso y el estado se actualicen en la interfaz de usuario.

## Funcionalidad JavaScript

*   **`uploadForm.addEventListener('submit')`:** Maneja la subida inicial del CSV y la obtención de las cabeceras para el mapeo.
*   **`mappingForm.addEventListener('submit')`:** Inicia el proceso de importación real y activa la monitorización del progreso.
*   **`monitorProgress()`:**
    *   Función que se ejecuta en un intervalo regular (cada segundo).
    *   Realiza peticiones `fetch` a `progress.php` para obtener el estado actual de la importación.
    *   Actualiza la barra de progreso y el texto de estado en la interfaz.
    *   Cuando la importación finaliza, detiene el intervalo y muestra el resumen final.

## Dependencias

*   `config.php`: Para la configuración general.
*   `style.css`: Para los estilos de la interfaz.
*   `process_csv.php`: Script de backend para el procesamiento real del CSV.
*   `progress.php`: Script de backend para monitorizar el progreso de la importación.