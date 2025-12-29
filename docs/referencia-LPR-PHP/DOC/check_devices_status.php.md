# Documentación de `check_devices_status.php`

## Descripción General

`check_devices_status.php` es un script de backend que funciona como un endpoint de servicio para verificar el estado de conexión de todas las cámaras LPR registradas en el sistema. Este script itera sobre cada dispositivo guardado en la base de datos y realiza una petición de diagnóstico para determinar si la cámara está en línea y si las credenciales de acceso son correctas.

El resultado es una respuesta JSON que el frontend puede utilizar para mostrar indicadores de estado (por ejemplo, LEDs de colores) para cada cámara.

## Flujo de Operación

1.  **Configuración Inicial:**
    *   Carga el archivo `config.php`.
    *   Establece la cabecera de la respuesta a `application/json`.
    *   Aumenta el límite de tiempo de ejecución del script a 60 segundos (`set_time_limit(60)`) para evitar timeouts si hay muchas cámaras que comprobar.

2.  **Conexión a la Base de Datos:**
    *   Se conecta a la base de datos MySQL.
    *   Obtiene una lista de todos los dispositivos (cámaras) de la tabla `devices`, incluyendo su ID, nombre, IP, usuario y contraseña.

3.  **Iteración y Verificación de Dispositivos:**
    *   Recorre cada cámara obtenida de la base de datos.
    *   Para cada cámara, realiza una petición de prueba al endpoint `/ISAPI/Traffic/channels/1/searchLPListAudit` de la API de la cámara.
    *   **Petición de Diagnóstico:**
        *   La petición se realiza mediante cURL y es de tipo `POST`.
        *   Se envía un cuerpo XML (`<LPSearchCond>`) solicitando un máximo de 1 resultado (`maxResult>1</maxResult>`). Esta es una operación de bajo impacto que sirve para confirmar que la API está respondiendo.
        *   La petición utiliza autenticación `DIGEST` con las credenciales de la cámara.
        *   Se establecen tiempos de espera (`CURLOPT_TIMEOUT` y `CURLOPT_CONNECTTIMEOUT`) para evitar que el script se bloquee si una cámara no responde.

4.  **Clasificación del Estado:**
    *   **Éxito:** Si la petición cURL devuelve un código de estado HTTP `200`, se considera que la cámara está en línea y funcionando correctamente. El estado se establece como `ok`.
    *   **Error de cURL:** Si cURL reporta un error (ej. no se puede resolver el host, tiempo de espera agotado), el estado se establece como `error` y se incluye el mensaje de error de cURL.
    *   **Error de HTTP:** Si la cámara responde con un código HTTP distinto de `200` (ej. 401 No Autorizado, 404 No Encontrado), el estado se establece como `error` y se incluye el código HTTP en el mensaje.

5.  **Respuesta JSON:**
    *   El script construye un array de resultados, donde cada elemento representa una cámara y contiene su `id`, `status` (`ok` o `error`) y un `message` descriptivo.
    *   Finalmente, imprime este array codificado en formato JSON.

## Respuesta de Salida (JSON)

El script devuelve un array de objetos JSON, donde cada objeto tiene la siguiente estructura:

```json
[
    {
        "id": "1",
        "status": "ok",
        "message": "Conexión exitosa."
    },
    {
        "id": "2",
        "status": "error",
        "message": "Error cURL: Could not resolve host: 192.168.1.200"
    }
]
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.