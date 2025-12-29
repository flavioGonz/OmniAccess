# Documentación de `get_camera_whitelist.php`

## Descripción General

`get_camera_whitelist.php` es un script de backend diseñado para obtener la lista blanca de matrículas de una cámara LPR específica y enriquecer esta información con datos de propietarios de la base de datos local. Actúa como un endpoint AJAX, proporcionando una API para que el frontend pueda auditar las matrículas configuradas en las cámaras.

## Flujo de Operación

1.  **Configuración y Recepción de Parámetros:**
    *   Incluye `config.php` para la configuración de la base de datos.
    *   Incluye `api_helpers.php` para acceder a la función `getWhitelistFromCamera`.
    *   Establece la cabecera de la respuesta a `application/json`.
    *   Recupera el `id` del dispositivo de los parámetros `GET`.
    *   Si no se proporciona un `id`, devuelve un error.

2.  **Obtención de Credenciales de la Cámara:**
    *   Se conecta a la base de datos MySQL.
    *   Busca en la tabla `devices` la IP, usuario y contraseña de la cámara correspondiente al `device_id` proporcionado.
    *   Si la cámara no se encuentra, devuelve un error.

3.  **Obtención de la Lista Blanca de la Cámara:**
    *   Llama a la función `getWhitelistFromCamera()` (definida en `api_helpers.php`) pasando las credenciales de la cámara.
    *   Esta función se encarga de comunicarse directamente con la API de la cámara para obtener su lista blanca, manejando la paginación si es necesario.

4.  **Enriquecimiento de Datos (Cruzar con Base de Datos Local):**
    *   Si la llamada a la cámara es exitosa y se obtienen matrículas:
        *   Extrae solo los números de matrícula de la lista obtenida de la cámara.
        *   Realiza una consulta SQL eficiente a la base de datos local (`vehicles` y `owners`) para encontrar los propietarios asociados a esas matrículas.
        *   Utiliza `PDO::FETCH_KEY_PAIR` para crear un array asociativo `[matrícula => nombre_propietario]`.
        *   Itera sobre las matrículas obtenidas de la cámara y las combina con los datos de propietario locales. Si una matrícula de la cámara no tiene un propietario registrado en la base de datos local, se le asigna el valor "No Registrado".

5.  **Respuesta JSON:**
    *   Devuelve una respuesta JSON que incluye:
        *   `success` (boolean): Indica si la operación fue exitosa.
        *   `message` (string): Un mensaje descriptivo.
        *   `data` (array): Un array de objetos, donde cada objeto contiene `plate_number` y `owner_name` (o "No Registrado").
    *   Maneja cualquier excepción general del servidor y devuelve un mensaje de error apropiado.

## Parámetros de Entrada (GET)

*   `id` (integer): El ID único del dispositivo (cámara) del cual se desea obtener la lista blanca.

## Respuesta de Salida (JSON)

```json
{
    "success": true,
    "message": "Lista blanca obtenida y enriquecida con éxito.",
    "data": [
        {
            "plate_number": "ABC123",
            "owner_name": "Juan Pérez"
        },
        {
            "plate_number": "XYZ789",
            "owner_name": "No Registrado"
        }
    ]
}
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.
*   `api_helpers.php`: Para la función `getWhitelistFromCamera()`.