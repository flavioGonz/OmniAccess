# Documentación de `setup_db.php`

## Descripción General

`setup_db.php` es un script de utilidad diseñado para inicializar o actualizar el esquema de la base de datos MySQL de la aplicación LPR. Este script se encarga de crear todas las tablas necesarias si no existen y de añadir nuevas columnas a tablas existentes, asegurando que la estructura de la base de datos sea compatible con las funcionalidades de la aplicación.

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Incluye `config.php` para obtener las credenciales de la base de datos (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`).
    *   Establece una conexión PDO a la base de datos MySQL. Si la base de datos no existe, PDO intentará crearla si el usuario tiene los permisos adecuados.
    *   Configura PDO para lanzar excepciones en caso de errores (`PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION`).

2.  **Creación de Tablas (CREATE TABLE IF NOT EXISTS):**
    *   El script ejecuta sentencias SQL `CREATE TABLE IF NOT EXISTS` para las siguientes tablas. Esto asegura que las tablas solo se creen si no existen, permitiendo ejecutar el script múltiples veces sin errores:
        *   **`vehicles`**: Almacena información sobre los vehículos, incluyendo matrícula, descripción, si está en lista blanca (`is_whitelisted`), y marcas de tiempo.
        *   **`events`**: Registra cada evento de detección de matrícula, vinculando con `vehicles`.
        *   **`owners`**: Almacena información de los propietarios, incluyendo un UID único, nombre, contacto, etc.
        *   **`lots`**: Almacena información sobre los lotes de estacionamiento, incluyendo un UID único, descripción y coordenadas geográficas.
        *   **`users`**: Almacena los usuarios del sistema con su nombre de usuario y un hash de contraseña.
        *   **`devices`**: Almacena la configuración de las cámaras LPR (nombre, IP, credenciales).
        *   **`owner_lot_associations`**: Tabla de unión para la relación muchos-a-muchos entre `owners` y `lots`, con claves foráneas que usan `ON DELETE CASCADE`.
        *   **`parking_sessions`**: Registra las sesiones de estacionamiento de los vehículos (entrada y salida).

3.  **Modificación de Tablas Existentes (ALTER TABLE):**
    *   El script intenta añadir columnas a tablas existentes si no las tienen. Esto es útil para actualizaciones del esquema sin perder datos:
        *   Añade `owner_id` a `vehicles`: Establece una relación con la tabla `owners` (`ON DELETE SET NULL` para desvincular vehículos si se elimina un propietario).
        *   Añade `is_inside` a `vehicles`: Un campo booleano para indicar si un vehículo está actualmente dentro del recinto.
        *   Añade `device_id` a `events`: Establece una relación con la tabla `devices` para vincular eventos a cámaras específicas.
    *   Utiliza bloques `try-catch` alrededor de las sentencias `ALTER TABLE` para manejar el error de "Duplicate column name" (columna ya existe), permitiendo que el script continúe sin fallar.

4.  **Manejo de Errores:**
    *   Captura `PDOException` para errores específicos de la base de datos y `Exception` para errores generales, mostrando mensajes informativos y registrándolos en el log de errores del servidor.

## Dependencias

*   `config.php`: Para las credenciales de conexión a la base de datos.