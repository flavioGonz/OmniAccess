# Documentación de `add_plate_to_camera.php`

## Descripción General

`add_plate_to_camera.php` es un script de backend diseñado para añadir una matrícula (patente) a la lista blanca (whitelist) de una cámara de reconocimiento de matrículas (LPR) específica. Este script recibe una solicitud JSON, se conecta a la base de datos para obtener las credenciales de la cámara y luego utiliza una función auxiliar para comunicarse con la API de la cámara y efectuar el registro.

## Flujo de Operación

1.  **Inicio y Configuración:**
    *   Inicia la sesión de PHP (`session_start()`).
    *   Carga los archivos de configuración (`config.php`) y las funciones auxiliares de la API (`api_helpers.php`).

2.  **Recepción de Datos:**
    *   Establece la cabecera de la respuesta a `application/json`.
    *   Lee y decodifica el cuerpo de la solicitud JSON para obtener `device_id` y `plate_number`.
    *   Valida que ambos parámetros, `device_id` (ID del dispositivo) y `plate_number` (número de matrícula), no estén vacíos. Si faltan, devuelve un error.

3.  **Interacción con la Base de Datos:**
    *   Establece una conexión con la base de datos MySQL utilizando las credenciales definidas en `config.php`.
    *   Busca en la tabla `devices` el dispositivo que coincide con el `device_id` proporcionado.
    *   Si el dispositivo no se encuentra, devuelve un mensaje de error.
    *   Si se encuentra, recupera la dirección IP, el nombre de usuario y la contraseña del dispositivo.

4.  **Preparación de la Llamada a la API:**
    *   Define el endpoint de la API de la cámara para añadir matrículas: `/ISAPI/Traffic/channels/{channel_id}/licensePlateAuditData/record?format=json`.
    *   Establece el método HTTP en `PUT`.
    *   Construye el cuerpo de la solicitud JSON (`$json_data`) que se enviará a la cámara. Este JSON contiene:
        *   `LicensePlate`: El número de matrícula a añadir.
        *   `listType`: Se establece como `"whiteList"`.
        *   `createTime`, `effectiveStartDate`, `effectiveTime`: Marcas de tiempo para la creación y validez del registro.

5.  **Llamada a la API:**
    *   Utiliza la función `call_camera_api()` (que se espera esté definida en `api_helpers.php`) para realizar la comunicación con la cámara.
    *   Pasa a esta función la IP, usuario, contraseña, el endpoint, el método y el cuerpo JSON.
    *   **Nota:** La definición de `call_camera_api` no se ha encontrado en el proyecto, lo que sugiere que el código puede estar incompleto.

6.  **Respuesta Final:**
    *   Si la llamada a la API de la cámara tiene éxito (`success: true`), el script devuelve un mensaje de éxito.
    *   Si la llamada a la API falla, devuelve un mensaje de error que incluye la respuesta de la API de la cámara.
    *   Captura y maneja cualquier excepción de la base de datos (`PDOException`) o errores inesperados (`Exception`), devolviendo mensajes de error apropiados.

## Parámetros de Entrada (JSON)

*   `device_id` (string): El ID único del dispositivo (cámara) al que se añadirá la matrícula.
*   `plate_number` (string): El número de matrícula a registrar en la lista blanca.

## Respuesta de Salida (JSON)

*   `success` (boolean): `true` si la operación fue exitosa, `false` en caso contrario.
*   `message` (string): Un mensaje descriptivo sobre el resultado de la operación.

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.
*   `api_helpers.php`: Para la función `call_camera_api()`.