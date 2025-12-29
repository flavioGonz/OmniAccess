# Documentación de `config.php`

## Descripción General

`config.php` es el archivo central de configuración para la aplicación LPR. Contiene constantes y funciones esenciales que se utilizan en todo el proyecto, incluyendo la configuración de la base de datos, la gestión de sesiones, un guardián de autenticación y funciones de seguridad CSRF.

## Contenido y Funcionalidades

### 1. Gestión de Sesiones

*   Asegura que la sesión de PHP se inicie si aún no está activa (`session_start()`).

### 2. Guardián de Autenticación

*   Este bloque de código actúa como un sistema de seguridad que redirige a los usuarios no autenticados a la página de `login.php`.
*   **Excepciones:** Se excluyen explícitamente `login.php`, `auth.php` y `webhook.php` de esta comprobación. Esto es crucial porque:
    *   `login.php` y `auth.php` son necesarios para el proceso de inicio de sesión.
    *   `webhook.php` es un endpoint al que acceden las cámaras LPR directamente (sin una sesión de usuario), por lo que no debe requerir autenticación de sesión.

### 3. Definición de la Raíz de la Aplicación

*   `define('APP_ROOT', __DIR__);`: Define una constante `APP_ROOT` que apunta al directorio donde se encuentra `config.php`. Esto facilita la construcción de rutas absolutas en otras partes de la aplicación.

### 4. Configuración de la Base de Datos MySQL

*   Define las constantes para la conexión a la base de datos MySQL:
    *   `DB_HOST`: Host de la base de datos (ej. `localhost`).
    *   `DB_NAME`: Nombre de la base de datos.
    *   `DB_USER`: Usuario de la base de datos.
    *   `DB_PASS`: Contraseña del usuario de la base de datos.
*   Se incluye una sección comentada para la configuración de SQLite, en caso de que se desee cambiar el tipo de base de datos en el futuro.

### 5. Configuración de Zona Horaria

*   `date_default_timezone_set('America/Argentina/Buenos_Aires');`: Establece la zona horaria predeterminada para todas las operaciones de fecha y hora en PHP, asegurando la consistencia en los registros de tiempo.

### 6. Funciones de Seguridad (CSRF)

*   **`generate_csrf_token()`:**
    *   **Propósito:** Genera un token CSRF (Cross-Site Request Forgery) único y seguro si no existe uno en la sesión actual. Si ya existe, devuelve el token existente.
    *   **Uso:** Debe ser llamado en formularios que envíen datos sensibles para proteger contra ataques CSRF.
*   **`validate_csrf_token($token)`:**
    *   **Propósito:** Valida un token CSRF recibido en una petición (normalmente `POST`) comparándolo de forma segura con el token almacenado en la sesión.
    *   **Seguridad:** Utiliza `hash_equals()` para realizar una comparación de tiempo constante, mitigando ataques de temporización.
    *   **Retorno:** `true` si el token es válido y coincide, `false` en caso contrario.

## Dependencias

Este archivo es una dependencia fundamental para casi todos los demás scripts PHP de la aplicación, ya que proporciona la configuración básica y las funciones de seguridad.