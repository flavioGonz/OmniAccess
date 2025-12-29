# Documentación de `webhook.php`

## Descripción General

`webhook.php` es el endpoint principal de la aplicación LPR para la recepción de eventos en tiempo real desde las cámaras Hikvision. Este script está diseñado para ser la URL a la que las cámaras envían sus notificaciones (webhooks) cuando detectan una matrícula. Se encarga de procesar los datos recibidos (XML y la imagen de la matrícula), identificar el dispositivo, gestionar la información del vehículo en la base de datos, actualizar el estado de ocupación y registrar el evento completo.

## Flujo de Operación

1.  **Configuración Inicial:**
    *   Incluye `config.php` para la configuración general y la definición de `APP_ROOT`.
    *   Establece la zona horaria a `America/Argentina/Buenos_Aires`.
    *   Define la ruta del archivo de log de errores (`hikvision_lpr.log`) y el directorio para guardar las imágenes de matrículas (`plate_images/`).
    *   Verifica y crea el directorio de imágenes si no existe, con permisos `0755`.

2.  **Conexión a la Base de Datos:**
    *   Establece una conexión PDO a la base de datos MySQL. En caso de error, registra el error y termina la ejecución.

3.  **Recepción y Procesamiento de Datos Multipart:**
    *   Detecta si la petición es `multipart/form-data` (formato común de los webhooks de Hikvision).
    *   Itera sobre los archivos subidos (`$_FILES`) para identificar y extraer el contenido XML del evento y los datos binarios de la imagen de la matrícula.
    *   **Seguridad:** Deshabilita temporalmente `libxml_disable_entity_loader(true)` antes de cargar el XML para prevenir ataques XXE.
    *   Si el XML no se puede parsear o no se recibe, registra un error y termina con un código `400`.

4.  **Identificación del Dispositivo (Cámara):**
    *   Extrae la `macAddress` del XML recibido.
    *   Consulta la tabla `devices` en la base de datos para encontrar el `id` y `name` de la cámara asociada a esa MAC Address.
    *   Esto permite identificar la cámara de origen de forma robusta, incluso si la IP de origen cambia debido a NAT.

5.  **Extracción y Limpieza de Datos del Evento:**
    *   Extrae la `licensePlate` y el `eventType` del XML.
    *   Limpia y formatea la matrícula (convierte a mayúsculas, elimina caracteres no alfanuméricos).
    *   Si no se encuentra la matrícula, registra un error y termina con un código `400`.

6.  **Obtención del Timestamp del Evento:**
    *   Prioriza el `dateTime` proporcionado por la cámara en el XML. Utiliza `strtotime()` para parsear el timestamp de la cámara.
    *   Si el timestamp de la cámara no está presente o no es válido, utiliza el timestamp del servidor (`time()`) como fallback.

7.  **Guardado de la Imagen de la Matrícula:**
    *   Si se recibieron datos de imagen, genera un nombre de archivo único utilizando la matrícula, el timestamp del evento y un `uniqid()`.
    *   Guarda la imagen en el directorio `plate_images/`.
    *   Almacena la ruta relativa de la imagen para su posterior uso en la base de datos.

8.  **Procesamiento de Vehículo y Sesión de Parking:**
    *   **Búsqueda de Vehículo:** Busca la matrícula en la tabla `vehicles`.
    *   **Creación de Nuevo Vehículo:** Si el vehículo no existe, lo crea automáticamente en la tabla `vehicles` y lo marca como `is_whitelisted = 0` y `is_inside = 0`.
    *   **Decisión de Acceso:** Determina la decisión (`acceso_permitido` o `acceso_denegado`) basándose en el estado `is_whitelisted` del vehículo en la base de datos.
    *   **Lógica de Sesión de Parking:**
        *   Identifica si la cámara es de "entrada" o "salida" basándose en su `device_name`.
        *   Si es una cámara de entrada y el vehículo está `is_inside = 0`, registra una nueva sesión en `parking_sessions` y actualiza `is_inside = 1` para el vehículo.
        *   Si es una cámara de salida y el vehículo está `is_inside = 1`, actualiza la última sesión abierta en `parking_sessions` con el `exit_time` y actualiza `is_inside = 0` para el vehículo.

9.  **Registro del Evento:**
    *   Inserta un nuevo registro en la tabla `events` con toda la información recopilada (ID de vehículo, matrícula, timestamp, tipo de evento, ruta de imagen, decisión, ID de dispositivo).

10. **Registro de Logs:**
    *   Registra detalladamente cada paso del procesamiento, incluyendo errores y decisiones, en el archivo `hikvision_lpr.log`.

11. **Respuesta a la Cámara:**
    *   Envía una respuesta XML (`<ResponseStatus>`) con `statusCode>1` y `statusString>OK` a la cámara. Esta respuesta es crucial para que la cámara confirme que el webhook fue recibido y procesado correctamente.

## Dependencias

*   `config.php`: Para la configuración general y la ruta raíz de la aplicación.
*   Base de datos MySQL: Para las tablas `vehicles`, `events`, `owners`, `devices`, `parking_sessions`.