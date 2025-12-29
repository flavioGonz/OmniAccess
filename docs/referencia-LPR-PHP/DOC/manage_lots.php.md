# Documentación de `manage_lots.php`

## Descripción General

`manage_lots.php` es el módulo de la aplicación LPR dedicado a la gestión de lotes de estacionamiento. Permite a los usuarios realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar) sobre los lotes y, lo que es más importante, gestionar las asociaciones entre propietarios y lotes. La interfaz es interactiva, utilizando modales para las operaciones de añadir/editar, eliminar y asignar propietarios.

## Flujo de Operación

### Backend (PHP)

1.  **Configuración y Seguridad:**
    *   Incluye `config.php` para la configuración de la base de datos y las funciones de seguridad CSRF.
    *   Genera y valida un token CSRF para proteger las peticiones POST.
    *   Maneja mensajes de éxito y error a través de variables de sesión para mostrarlos después de una redirección.

2.  **Manejo de Peticiones POST:**
    *   **`save_lot` (Añadir/Editar Lote):**
        *   Recupera la descripción y el UID del lote.
        *   Si se proporciona un `lot_id`, actualiza el lote existente; de lo contrario, inserta un nuevo lote.
    *   **`delete_lot` (Eliminar Lote):**
        *   Elimina un lote de la tabla `lots` basándose en su `id`.
        *   Se asume que la base de datos tiene configurada una clave foránea con `ON DELETE CASCADE` para `owner_lot_associations`, lo que eliminaría automáticamente las asociaciones relacionadas.
    *   **`assign_owner` (Asignar Propietario a Lote):**
        *   Crea una nueva asociación en la tabla `owner_lot_associations` entre un propietario y un lote.
    *   **`unassign_owner` (Desvincular Propietario de Lote):**
        *   Elimina una asociación específica de la tabla `owner_lot_associations`.
    *   Después de cada acción POST, redirige a la misma página (o a la vista de gestión de propietarios de un lote específico) para evitar el reenvío del formulario y mostrar los mensajes.

3.  **Obtención de Datos (GET):**
    *   Recupera los lotes de la base de datos, incluyendo un conteo de los propietarios asignados a cada lote.
    *   Permite buscar lotes por descripción o UID.
    *   Si se solicita `manage_owners_for` (gestionar propietarios para un lote específico), carga:
        *   Los propietarios ya asignados a ese lote.
        *   Los propietarios que aún no están asignados a ese lote (para el selector de asignación).

### Frontend (HTML/CSS/JavaScript)

1.  **Tabla de Lotes:**
    *   Muestra una tabla con la descripción, UID y el número de propietarios asignados a cada lote.
    *   Ofrece botones para "Editar", "Ver/Asignar Propietarios" y "Eliminar" para cada lote.

2.  **Modales Interactivos:**
    *   **Modal "Añadir/Editar Lote":**
        *   Permite introducir o modificar la descripción y el UID de un lote.
    *   **Modal "Gestionar Propietarios de un Lote":**
        *   Muestra dos secciones: "Propietarios Asignados" (con opción de desvincular) y "Asignar Propietario Existente" (con un selector de propietarios no asignados).
        *   Este modal se abre automáticamente si se accede a la página con el parámetro `manage_owners_for`.
    *   **Modal "Confirmar Eliminación":**
        *   Pide confirmación antes de eliminar un lote, advirtiendo que también se eliminarán sus asociaciones.
    *   **Modal "Buscar Lote":**
        *   Permite buscar lotes por descripción o UID.

3.  **Botón de Acción Flotante (FAB):**
    *   Un botón FAB que, al hacer clic, expande un menú con opciones para "Añadir Lote" y "Buscar / Filtrar".

## Dependencias

*   `config.php`: Para la configuración general y funciones CSRF.
*   `style.css`: Para los estilos de la interfaz.