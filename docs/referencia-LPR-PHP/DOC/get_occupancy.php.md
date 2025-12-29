# Documentación de `get_occupancy.php`

## Descripción General

`get_occupancy.php` es un script de backend simple que proporciona la ocupación actual del estacionamiento o área controlada por el sistema LPR. Consulta la base de datos para contar cuántos vehículos tienen el estado `is_inside` establecido en `1` (indicando que están dentro) y devuelve este número en formato JSON.

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Incluye `config.php` para obtener las credenciales de la base de datos.
    *   Establece la cabecera de la respuesta a `application/json`.
    *   Establece una conexión a la base de datos MySQL utilizando PDO.
    *   En caso de error de conexión, devuelve un mensaje de error JSON y termina la ejecución.

2.  **Consulta de Ocupación:**
    *   Ejecuta una consulta `SELECT COUNT(*)` en la tabla `vehicles`.
    *   La condición `WHERE is_inside = 1` asegura que solo se cuenten los vehículos que actualmente se consideran dentro del área.
    *   `fetchColumn()` se utiliza para obtener directamente el resultado del conteo.

3.  **Salida JSON:**
    *   Devuelve un objeto JSON con la clave `occupancy` que contiene el número total de vehículos dentro.
    *   Maneja cualquier `PDOException` o `Exception` general, devolviendo un mensaje de error JSON si ocurre algún problema durante la consulta.

## Respuesta de Salida (JSON)

**Éxito:**

```json
{
    "occupancy": 15
}
```

**Error:**

```json
{
    "error": "Error al obtener la ocupación: SQLSTATE[HY000]: General error: 1 no such table: vehicles"
}
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.