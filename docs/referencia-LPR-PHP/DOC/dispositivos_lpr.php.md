# Documentación de `dispositivos_lpr.php`

## Descripción General

`dispositivos_lpr.php` es la interfaz de usuario principal para la gestión de dispositivos (cámaras LPR) en el sistema. Permite a los usuarios añadir, editar y eliminar cámaras, así como visualizar su estado de conexión y auditar las matrículas en sus listas blancas. La página combina lógica de backend (PHP) para la gestión de datos y una interfaz de usuario interactiva (HTML/CSS/JavaScript) con modales para las operaciones.

## Flujo de Operación

### Backend (PHP)

1.  **Configuración y Seguridad:**
    *   Incluye `config.php` para la configuración de la base de datos y las funciones de seguridad CSRF.
    *   Incluye `api_helpers.php` para funciones relacionadas con la API de la cámara.
    *   Genera y valida un token CSRF para proteger las peticiones POST.

2.  **Conexión a la Base de Datos:**
    *   Establece una conexión PDO a la base de datos MySQL.

3.  **Manejo de Peticiones POST (Añadir/Editar/Eliminar Dispositivo):**
    *   **`save_device` (Añadir/Editar):**
        *   Valida los campos de entrada (`name`, `ip`, `mac_address`, `username`, `password`, `purpose`).
        *   Realiza validaciones de formato para la IP y la MAC Address.
        *   Si se proporciona un `id` existente, actualiza el dispositivo en la tabla `devices`.
        *   Si no se proporciona un `id`, inserta un nuevo dispositivo. La contraseña es obligatoria para nuevos dispositivos.
        *   Maneja errores de duplicidad (nombre o MAC Address ya existentes).
    *   **`delete_device` (Eliminar):**
        *   Elimina un dispositivo de la tabla `devices` basándose en su `id`.
        *   Maneja errores si el dispositivo tiene eventos asociados (restricciones de integridad referencial).
    *   Después de cada operación, almacena mensajes de éxito o error en la sesión y redirige a la misma página para evitar el reenvío del formulario.

4.  **Recuperación de Dispositivos:**
    *   Consulta la base de datos para obtener todos los dispositivos registrados, incluyendo el campo `purpose` (propósito).

### Frontend (HTML/CSS/JavaScript)

1.  **Visualización de Dispositivos:**
    *   Muestra una tabla con todos los dispositivos configurados, incluyendo su nombre, propósito (Entrada/Salida/Indefinido), IP, MAC Address y usuario.
    *   Cada fila incluye un "LED" de estado que se actualiza dinámicamente mediante JavaScript.

2.  **Modales Interactivos:**
    *   **Modal "Añadir/Editar Dispositivo":**
        *   Se abre al hacer clic en "Añadir Nuevo Dispositivo" o en el botón "Editar" de una fila.
        *   Permite introducir o modificar los detalles del dispositivo, incluyendo el nuevo campo `purpose`.
        *   La contraseña se puede dejar en blanco al editar para no cambiarla.
    *   **Modal "Auditoría de Lista Blanca":**
        *   Se abre al hacer clic en "Ver Lista" para un dispositivo específico.
        *   Realiza una petición AJAX a `get_camera_whitelist.php` para obtener la lista blanca de la cámara.
        *   Muestra las matrículas de la cámara y las cruza con la base de datos local para mostrar el propietario si está registrado.
        *   Incluye una barra de búsqueda para filtrar las matrículas mostradas.
    *   **Modal "Confirmar Eliminación":**
        *   Se abre al hacer clic en el botón "Eliminar".
        *   Pide confirmación antes de eliminar un dispositivo y advierte sobre posibles problemas de integridad referencial.

3.  **Comprobación de Estado de Cámaras (LEDs):**
    *   Una función JavaScript (`checkAllDevicesStatus()`) realiza una petición AJAX a `check_devices_status.php`.
    *   Actualiza el "LED" de estado de cada dispositivo en la tabla (verde para `ok`, rojo para `error`) y muestra un mensaje en el `tooltip`.
    *   Esta comprobación se ejecuta al cargar la página y se repite cada 60 segundos.

## Dependencias

*   `config.php`: Configuración de la base de datos y funciones de seguridad.
*   `api_helpers.php`: Funciones para interactuar con la API de la cámara.
*   `check_devices_status.php`: Endpoint para verificar el estado de las cámaras.
*   `get_camera_whitelist.php`: Endpoint para obtener la lista blanca de una cámara.
*   `style.css`: Estilos CSS para la interfaz de usuario.