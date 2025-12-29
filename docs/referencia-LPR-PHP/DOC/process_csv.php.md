# Documentación de `process_csv.php`

## Descripción General

`process_csv.php` es un script de backend que maneja el procesamiento de archivos CSV para la importación masiva de datos de propietarios y vehículos. Funciona en dos modos principales: `preview` (previsualización) para obtener las cabeceras del CSV, e `import` (importación) para procesar los datos y actualizarlos en la base de datos. Está diseñado para trabajar en conjunto con `importar_datos.php` (el frontend) y `progress.php` (para la monitorización del progreso).

## Flujo de Operación

### Modo `action=preview`

1.  **Recepción del Archivo:**
    *   Recibe el archivo CSV subido a través de `$_FILES['csv_file']`.
    *   Verifica si la subida fue exitosa.

2.  **Almacenamiento Temporal:**
    *   Mueve el archivo CSV subido a un directorio temporal del sistema (`sys_get_temp_dir()`) con un nombre único basado en el ID de sesión.

3.  **Extracción de Cabeceras:**
    *   Abre el archivo temporal y lee la primera línea para obtener las cabeceras (o la primera fila de datos si no hay cabeceras explícitas).

4.  **Respuesta JSON:**
    *   Devuelve una respuesta JSON que incluye:
        *   `success`: `true` si la operación fue exitosa.
        *   `filepath`: La ruta completa del archivo CSV temporal en el servidor.
        *   `headers`: Un array con las cabeceras (o la primera fila de datos) del CSV.

### Modo `action=import`

1.  **Configuración para Procesos Largos:**
    *   `ignore_user_abort(true)`: Permite que el script continúe ejecutándose incluso si el usuario cierra la conexión del navegador.
    *   `set_time_limit(0)`: Elimina el límite de tiempo de ejecución del script, permitiendo procesar archivos CSV muy grandes.

2.  **Recepción de Parámetros:**
    *   Recibe la `filepath` del archivo CSV temporal, y los índices de columna para `plate_column` y `owner_column`.
    *   Verifica la existencia del archivo y la validez de los índices de columna.

3.  **Inicialización del Progreso:**
    *   Inicializa una variable de sesión `$_SESSION['import_progress']` con el estado actual del proceso (línea actual, total de líneas, estado de finalización y un resumen de las operaciones).
    *   `session_write_close()`: Libera el bloqueo de la sesión para que `progress.php` pueda leer el estado del progreso en tiempo real.

4.  **Procesamiento del CSV (Transaccional):**
    *   Establece una conexión PDO a la base de datos.
    *   Inicia una transacción de base de datos (`beginTransaction()`) para asegurar la atomicidad de la operación: si ocurre un error, todos los cambios se pueden revertir (`rollBack()`).
    *   Abre el archivo CSV temporal y lee línea por línea.
    *   **Actualización de Progreso:** En cada línea, actualiza el estado de progreso en la sesión y vuelve a liberar el bloqueo de la sesión.
    *   **Extracción y Limpieza de Datos:** Extrae la matrícula y el nombre del propietario de la línea actual, limpiando y formateando la matrícula.
    *   **Lógica de Importación (por cada línea):**
        *   **Propietario:** Busca el propietario por nombre. Si no existe, crea un nuevo registro en la tabla `owners` y asigna un `owner_uid` único.
        *   **Vehículo:** Busca el vehículo por matrícula. Si existe, actualiza su `owner_id` y `is_whitelisted` a `1`. Si no existe, crea un nuevo registro en la tabla `vehicles` con el `owner_id` y `is_whitelisted` a `1`.
        *   Actualiza las estadísticas de resumen en la sesión (`lines_processed`, `owners_created`, `vehicles_created`, `vehicles_assigned`).

5.  **Finalización:**
    *   Si el procesamiento se completa sin errores, confirma la transacción (`commit()`).
    *   Marca el proceso como `done` en la variable de sesión de progreso.
    *   Elimina el archivo CSV temporal del servidor.
    *   En caso de cualquier excepción, revierte la transacción y registra el error (no se envía al cliente ya que la conexión puede estar cerrada).

## Dependencias

*   `config.php`: Para la configuración de la base de datos.
*   `progress.php`: Utilizado por el frontend para leer el estado del progreso.