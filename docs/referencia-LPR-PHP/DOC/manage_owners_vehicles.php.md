# Documentación de `manage_owners_vehicles.php`

## Descripción General

`manage_owners_vehicles.php` es el módulo de la aplicación LPR dedicado a la gestión de propietarios y sus vehículos asociados. Permite a los usuarios realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar) sobre los propietarios y asignar/desvincular vehículos a/de ellos. La interfaz es interactiva, utilizando modales para las operaciones de añadir/editar, eliminar y gestionar vehículos.

## Flujo de Operación

### Backend (PHP)

1.  **Configuración y Seguridad:**
    *   Incluye `config.php` para la configuración de la base de datos y las funciones de seguridad CSRF.
    *   Genera y valida un token CSRF para proteger las peticiones POST.
    *   Maneja mensajes de éxito y error a través de variables de sesión para mostrarlos después de una redirección.

2.  **Manejo de Peticiones POST:**
    *   **`save_owner` (Añadir/Editar Propietario):**
        *   Recupera el nombre y el contacto del propietario.
        *   Si se proporciona un `owner_id`, actualiza el propietario existente; de lo contrario, inserta un nuevo propietario.
    *   **`delete_owner` (Eliminar Propietario):**
        *   Elimina un propietario de la tabla `owners` basándose en su `id`.
        *   Se asume que la base de datos tiene configurada una clave foránea en la tabla `vehicles` con `ON DELETE SET NULL` para `owner_id`, lo que desvinculará automáticamente los vehículos asociados sin eliminarlos.
    *   **`assign_vehicle` (Asignar Vehículo a Propietario):**
        *   Asegura que la matrícula exista en la tabla `vehicles` (la crea si no existe, o la actualiza si ya está). Esto permite que vehículos sin propietario previo puedan ser asignados.
        *   Asigna el `owner_id` al vehículo correspondiente en la tabla `vehicles`.
    *   **`unassign_vehicle` (Desvincular Vehículo de Propietario):**
        *   Establece el `owner_id` del vehículo a `NULL`, desvinculándolo del propietario actual.
    *   Después de cada acción POST, redirige a la misma página (o a la vista de gestión de vehículos de un propietario específico) para evitar el reenvío del formulario y mostrar los mensajes.

3.  **Obtención de Datos (GET):**
    *   Recupera los propietarios de la base de datos, incluyendo un conteo de los vehículos asociados a cada propietario.
    *   Permite buscar propietarios por nombre o contacto.
    *   Si se solicita `manage_vehicles_for` (gestionar vehículos para un propietario específico), carga:
        *   Los vehículos ya asignados a ese propietario.

### Frontend (HTML/CSS/JavaScript)

1.  **Tabla de Propietarios:**
    *   Muestra una tabla con el nombre, contacto y el número de vehículos registrados para cada propietario.
    *   Ofrece botones para "Editar", "Ver/Asignar Vehículos" y "Eliminar" para cada propietario.

2.  **Modales Interactivos:**
    *   **Modal "Añadir/Editar Propietario":**
        *   Permite introducir o modificar el nombre y el contacto de un propietario.
    *   **Modal "Gestionar Vehículos de un Propietario":**
        *   Muestra los vehículos ya asignados al propietario (con opción de desvincular).
        *   Permite asignar un nuevo vehículo al propietario introduciendo su matrícula.
        *   Este modal se abre automáticamente si se accede a la página con el parámetro `manage_vehicles_for`.
    *   **Modal "Confirmar Eliminación":**
        *   Pide confirmación antes de eliminar un propietario, advirtiendo que sus vehículos serán desvinculados.
    *   **Modal "Buscar Propietario":**
        *   Permite buscar propietarios por nombre o contacto.

3.  **Botón de Acción Flotante (FAB):**
    *   Un botón FAB que, al hacer clic, expande un menú con opciones para "Añadir Propietario" y "Buscar / Filtrar".

## Dependencias

*   `config.php`: Para la configuración general y funciones CSRF.
*   `style.css`: Para los estilos de la interfaz.