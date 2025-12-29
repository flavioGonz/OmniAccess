# Documentación de `update_event_notes.php`

## Descripción General

`update_event_notes.php` es un script de backend diseñado para actualizar las notas (observaciones) asociadas a un evento de matrícula específico en la base de datos. Funciona como un endpoint de API que recibe peticiones POST con el ID del evento y el nuevo texto de las notas, y devuelve una respuesta JSON indicando el éxito o fracaso de la operación.

## Flujo de Operación

1.  **Configuración y Cabeceras:**
    *   Incluye `config.php` para obtener las credenciales de la base de datos.
    *   Establece la cabecera de la respuesta a `application/json`.

2.  **Validación del Método de Solicitud:**
    *   Verifica que la solicitud HTTP sea de tipo `POST`. Si no lo es, devuelve un mensaje de error.

3.  **Recepción y Validación de Datos:**
    *   Recupera `event_id` y `notes` de los datos enviados por `POST`.
    *   Verifica que ambos parámetros no sean nulos. Si faltan, devuelve un mensaje de "Datos incompletos".

4.  **Conexión a la Base de Datos:**
    *   Establece una conexión PDO a la base de datos MySQL.

5.  **Actualización del Evento:**
    *   Prepara y ejecuta una sentencia `UPDATE` para la tabla `events`.
    *   Actualiza la columna `notes` para el evento cuyo `id` coincide con el `event_id` proporcionado.
    *   Verifica `rowCount()` para determinar si la actualización afectó a alguna fila. Si `rowCount()` es mayor que 0, la operación se considera exitosa.

6.  **Respuesta JSON:**
    *   Devuelve un objeto JSON con las claves `success` (booleano) y `message` (string).
    *   `success` será `true` si la observación se guardó correctamente, `false` en caso contrario.
    *   `message` contendrá un mensaje descriptivo del resultado (éxito, datos incompletos, evento no encontrado, error de base de datos, etc.).

## Parámetros de Entrada (POST)

*   `id` (integer): El ID único del evento de matrícula a actualizar.
*   `notes` (string): El nuevo texto de las observaciones para el evento.

## Respuesta de Salida (JSON)

**Éxito:**

```json
{
    "success": true,
    "message": "Observación guardada con éxito."
}
```

**Error (ejemplo):**

```json
{
    "success": false,
    "message": "Datos incompletos."
}
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.