# Documentación de `progress.php`

## Descripción General

`progress.php` es un script de backend muy simple diseñado para proporcionar el estado actual del progreso de una operación de importación masiva (como la que realiza `process_csv.php`). Actúa como un endpoint AJAX que el frontend (ej. `importar_datos.php`) consulta periódicamente para actualizar una barra de progreso o un mensaje de estado en la interfaz de usuario.

## Flujo de Operación

1.  **Inicio de Sesión:**
    *   Asegura que la sesión de PHP esté iniciada (`session_start()`) para poder acceder a la variable de sesión que almacena el progreso.

2.  **Cabecera de Respuesta:**
    *   Establece la cabecera `Content-Type` a `application/json` para indicar que la respuesta será en formato JSON.

3.  **Recuperación del Progreso:**
    *   Intenta recuperar el array de progreso almacenado en `$_SESSION['import_progress']`.
    *   Si la variable de sesión no existe (por ejemplo, si la importación aún no ha comenzado), devuelve un array con valores iniciales por defecto (`current: 0`, `total: 0`, `done: false`, `summary: []`).

4.  **Salida JSON:**
    *   Codifica el array de progreso (ya sea el real de la sesión o el por defecto) en formato JSON y lo imprime en la salida.

## Estructura de Datos de Progreso (Ejemplo)

El array `$_SESSION['import_progress']` (y por lo tanto la respuesta JSON) típicamente contiene la siguiente estructura:

```json
{
    "current": 150,             // Número de líneas procesadas hasta el momento
    "total": 1000,              // Número total de líneas en el archivo CSV
    "done": false,              // true si la importación ha finalizado, false en caso contrario
    "summary": {                // Resumen de las operaciones realizadas
        "lines_processed": 150,
        "owners_created": 10,
        "vehicles_created": 50,
        "vehicles_assigned": 150
    }
}
```

## Dependencias

*   `process_csv.php`: Es el script que actualiza la variable de sesión `$_SESSION['import_progress']`.
*   `importar_datos.php`: Es el script de frontend que consume la información de `progress.php`.