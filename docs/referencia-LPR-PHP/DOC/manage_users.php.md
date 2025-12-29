# Documentación de `manage_users.php`

## Descripción General

`manage_users.php` es el módulo de administración de usuarios de la aplicación LPR. Permite a los administradores ver una lista de usuarios existentes, añadir nuevos usuarios, editar sus nombres de usuario y contraseñas, y eliminar usuarios. La interfaz es interactiva, utilizando modales para las operaciones de añadir/editar y eliminar, y un botón de acción flotante (FAB) para añadir nuevos usuarios.

## Flujo de Operación

### Backend (PHP)

1.  **Configuración y Seguridad:**
    *   Asume que `config.php` ya ha sido incluido (por `index.php`) y que la conexión `$pdo` está disponible.
    *   Genera un token CSRF para proteger las peticiones POST.
    *   Maneja mensajes de éxito y error a través de variables de sesión, que luego se muestran como "toasts" en el frontend.

2.  **Obtención de Usuarios:**
    *   Consulta la base de datos para obtener todos los usuarios registrados (`id`, `username`, `created_at`) de la tabla `users`, ordenados alfabéticamente por nombre de usuario.

3.  **Manejo de Peticiones POST (a través de `auth.php`):**
    *   Aunque este archivo es la interfaz, las acciones de `add_edit_user` y `delete_user` se envían a `index.php?page=manage_users` y son procesadas por un script de backend (probablemente `auth.php` o una lógica similar que se incluye o se ejecuta antes de la renderización de esta página, aunque no se ve directamente en este archivo). Se asume que estas acciones:
        *   Validan el token CSRF.
        *   Realizan la inserción, actualización o eliminación en la tabla `users`.
        *   Manejan el hashing de contraseñas para seguridad.
        *   Almacenan mensajes de éxito/error en la sesión.

### Frontend (HTML/CSS/JavaScript)

1.  **Tabla de Usuarios:**
    *   Muestra una tabla con el nombre de usuario y la fecha de creación de cada usuario.
    *   Para cada usuario, ofrece botones para "Editar" y "Eliminar".
    *   El botón "Eliminar" está deshabilitado para el usuario actualmente logueado para evitar que se elimine a sí mismo.

2.  **Modales Interactivos:**
    *   **Modal "Añadir/Editar Usuario" (`user-modal`):**
        *   Se abre al hacer clic en el botón FAB o en el botón "Editar" de una fila.
        *   Permite introducir o modificar el nombre de usuario y la contraseña.
        *   Al editar, la contraseña se puede dejar en blanco para no cambiarla.
    *   **Modal "Confirmar Eliminación" (`delete-modal`):**
        *   Se abre al hacer clic en el botón "Eliminar" de una fila.
        *   Pide confirmación antes de eliminar un usuario y advierte que la acción es irreversible.

3.  **Botón de Acción Flotante (FAB):**
    *   Un botón FAB (`+`) en la esquina inferior derecha que, al hacer clic, abre el modal para añadir un nuevo usuario.

4.  **Toasts de Notificación:**
    *   Utiliza JavaScript (`showToast()`) para mostrar mensajes de éxito o error como notificaciones emergentes en la interfaz de usuario, basándose en los mensajes almacenados en la sesión por el backend.

## Dependencias

*   `config.php`: Para la configuración general y funciones CSRF.
*   `includes/css/manage_users.css`: Estilos específicos para este módulo.
*   `includes/js/toast.js`: Para la funcionalidad de los mensajes "toast".
*   `includes/js/manage_users.js`: Lógica JavaScript para la interacción de los modales y botones.
*   Font Awesome (CDN): Para los iconos.