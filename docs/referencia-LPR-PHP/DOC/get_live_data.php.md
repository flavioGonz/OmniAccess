# Documentación de `get_live_data.php`

## Descripción General

`get_live_data.php` es un script de backend que actúa como un endpoint AJAX para proporcionar datos en tiempo real de los últimos eventos LPR. Su función principal es recuperar los eventos más recientes de la base de datos, enriquecerlos con información de vehículos, propietarios, lotes y dispositivos, y devolverlos en formato JSON para ser consumidos por una interfaz de usuario en vivo (como un dashboard o consola).

## Flujo de Operación

1.  **Configuración y Cabeceras:**
    *   Incluye `config.php` para la configuración de la base de datos.
    *   Establece las cabeceras HTTP para asegurar que la respuesta sea JSON y para evitar el almacenamiento en caché (`no-cache`).

2.  **Conexión a la Base de Datos:**
    *   Establece una conexión PDO a la base de datos MySQL.
    *   En caso de error de conexión, registra el error y devuelve una respuesta JSON vacía para evitar fallos en el frontend.

3.  **Obtención y Enriquecimiento de Eventos:**
    *   Ejecuta una consulta SQL compleja para obtener los últimos 20 eventos de la tabla `events`.
    *   La consulta utiliza múltiples `LEFT JOIN` para:
        *   Obtener información del vehículo (`is_whitelisted`, `is_inside`) de la tabla `vehicles`.
        *   Obtener el nombre del propietario (`owner_name`) de la tabla `owners`.
        *   Obtener los nombres de los lotes asociados (`lot_names`) a través de `owner_lot_associations` y `lots`.
        *   Obtener el nombre del dispositivo (`device_name`) de la tabla `devices`.
    *   Los eventos se ordenan por `timestamp` y `id` de forma descendente para asegurar que los más recientes aparezcan primero.
    *   El `timestamp` se convierte a formato Unix para facilitar su manipulación en el frontend.

4.  **Formateo de la Respuesta:**
    *   Itera sobre los eventos obtenidos de la base de datos.
    *   Formatea cada evento en un array asociativo con claves estandarizadas (`id`, `plate`, `datetime`, `decision`, `image_path`, `device_name`, `owner_name`, `lot_names`, `notes`, `is_inside`).
    *   Aplica `htmlspecialchars()` a todos los valores de cadena para prevenir ataques XSS.
    *   Asegura que la `image_path` sea una URL absoluta y proporciona un `placeholder.jpg` si la ruta está vacía.
    *   Recopila los nombres de los dispositivos para depuración (`debug_device_names`).

5.  **Salida JSON:**
    *   Devuelve un objeto JSON que contiene:
        *   `events`: Un array de los eventos formateados.
        *   `debug_device_names`: Un array de nombres de dispositivos únicos para propósitos de depuración.

## Respuesta de Salida (JSON)

```json
{
    "events": [
        {
            "id": "123",
            "plate": "ABC123",
            "datetime": "2025-08-08 10:30:00",
            "decision": "permitido",
            "image_path": "/LPR/plate_images/ABC123_timestamp.jpg",
            "device_name": "Camara Entrada",
            "owner_name": "Juan Pérez",
            "lot_names": "Lote A, Lote B",
            "notes": "Acceso autorizado",
            "is_inside": true
        }
        // ... más eventos
    ],
    "debug_device_names": [
        "Camara Entrada",
        "Camara Salida"
    ]
}
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.