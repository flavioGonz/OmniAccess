# Documentación de `api_helpers.php`

## Descripción General

`api_helpers.php` es una librería de funciones de PHP diseñada para centralizar la comunicación con la API ISAPI de las cámaras LPR de Hikvision. Este archivo contiene funciones específicas para obtener la lista blanca (whitelist), y añadir o eliminar matrículas de ella.

**Nota:** Existe un archivo `api_helpers copy.php` que contiene una versión más avanzada de la función `getWhitelistFromCamera` con lógica de paginación. La versión en `api_helpers.php` no incluye esta paginación.

## Funciones Disponibles

### `getWhitelistFromCamera($camera)`

*   **Propósito:** Lee la lista blanca completa de una cámara, manejando la paginación de la API.
*   **Parámetros:**
    *   `$camera` (array): Un array asociativo que debe contener `ip`, `username` y `password` de la cámara.
*   **Retorno:** Un array asociativo con las siguientes claves:
    *   `success` (boolean): `true` si la operación fue exitosa, `false` si hubo un error.
    *   `data` (array|string): Si tiene éxito, un array de matrículas. Si falla, un string con el mensaje de error.
*   **Lógica:**
    1.  Inicializa un bucle `while` para realizar peticiones paginadas.
    2.  Construye una petición XML (`LPSearchCond`) para solicitar una página de resultados.
    3.  Utiliza cURL para enviar la petición a la cámara con autenticación `DIGEST`.
    4.  Maneja errores de cURL y códigos de estado HTTP.
    5.  Parsea la respuesta XML y extrae las matrículas.
    6.  Agrega las matrículas de la página actual al resultado total.
    7.  El bucle continúa hasta que la cámara devuelve menos resultados que el tamaño de la página, indicando que es la última página.

### `addPlateToCameraWhitelist($camera, $plate)`

*   **Propósito:** Añade una matrícula a la lista blanca de una cámara específica.
*   **Parámetros:**
    *   `$camera` (array): Un array asociativo con `ip`, `username`, `password` y `name` de la cámara.
    *   `$plate` (string): La matrícula a añadir.
*   **Retorno:** Un array con `success` (boolean) y `message` (string).
*   **Lógica:**
    1.  Define el endpoint de la API: `/ISAPI/AccessControl/vehicleRecord?format=json`.
    2.  Construye un cuerpo JSON con la matrícula y el tipo de lista (`whiteList`).
    3.  Realiza una petición `PUT` a la cámara usando cURL.
    4.  Verifica el código de respuesta HTTP y el contenido de la respuesta JSON para determinar si la operación fue exitosa.

### `deletePlateFromCameraWhitelist($camera, $plate)`

*   **Propósito:** Elimina una matrícula de la lista blanca de una cámara.
*   **Parámetros:**
    *   `$camera` (array): Un array asociativo con `ip`, `username`, `password` y `name` de la cámara.
    *   `$plate` (string): La matrícula a eliminar.
*   **Retorno:** Un array con `success` (boolean) y `message` (string).
*   **Lógica:**
    1.  Codifica la matrícula para que sea segura en una URL.
    2.  Define el endpoint de la API, incluyendo la matrícula en la URL: `/ISAPI/AccessControl/vehicleRecord/plateNo/{$encoded_plate}?format=json`.
    3.  Realiza una petición `DELETE` a la cámara usando cURL.
    4.  Verifica la respuesta para determinar si la eliminación fue exitosa.

## Función Faltante

*   `call_camera_api()`: El archivo `add_plate_to_camera.php` hace referencia a esta función, pero no está definida en `api_helpers.php` ni en `api_helpers copy.php`. Esto sugiere que el código del proyecto está incompleto.