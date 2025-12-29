# Documentación de `events.php`

## Descripción General

`events.php` es un script PHP que muestra un historial básico de los eventos de matrículas capturadas por el sistema LPR. Se conecta a la base de datos, recupera todos los eventos registrados y los presenta en una tabla HTML. Este script es una vista directa de los datos sin funcionalidades avanzadas de filtrado o paginación, a diferencia de `event_history.php`.

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Incluye `config.php` para obtener las credenciales de la base de datos.
    *   Establece una conexión a la base de datos MySQL utilizando PDO. Si la conexión falla, el script termina y muestra un error.

2.  **Obtención de Eventos:**
    *   Realiza una consulta `SELECT *` a la tabla `events`.
    *   Ordena los resultados por la columna `timestamp` en orden descendente (`ORDER BY timestamp DESC`) para mostrar los eventos más recientes primero.
    *   Almacena todos los eventos recuperados en la variable `$events`.

## Interfaz de Usuario (HTML)

*   **Tabla de Eventos:**
    *   Presenta una tabla HTML con las siguientes columnas para cada evento:
        *   `ID`: Identificador único del evento.
        *   `Matrícula`: El número de matrícula detectado.
        *   `Fecha/Hora`: La marca de tiempo del evento.
        *   `Tipo Evento`: El tipo de evento (ej. `entrada`, `salida`).
        *   `Decisión`: La decisión tomada por el sistema (ej. `permitido`, `denegado`, `desconocido`). Se aplica un estilo visual (color) según la decisión.
        *   `Imagen`: Una miniatura de la imagen de la matrícula capturada. Si existe una ruta de imagen, se muestra como un enlace a la imagen completa.
        *   `Notas`: Cualquier nota asociada al evento.
    *   Si no hay eventos registrados en la base de datos, se muestra un mensaje indicándolo.

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.