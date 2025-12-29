# Documentación de `manage_access_lists.php`

## Descripción General

`manage_access_lists.php` es el módulo principal para la gestión de matrículas en las diferentes listas de acceso (lista blanca, lista negra, proveedores). Permite a los usuarios ver, añadir y eliminar matrículas, con la capacidad de sincronizar automáticamente las matrículas de la lista blanca con las cámaras LPR configuradas. La interfaz incluye un sistema de pestañas para navegar entre las listas, paginación y filtros de búsqueda.

## Flujo de Operación

### Backend (PHP)

1.  **Configuración y Seguridad:**
    *   Incluye `api_helpers.php` para las funciones de comunicación con la API de la cámara.
    *   Genera y valida un token CSRF para proteger todas las peticiones POST.
    *   Maneja mensajes de éxito y error a través de variables de sesión para mostrarlos después de una redirección.

2.  **Manejo de Peticiones POST:**
    *   **`add_plate` (Añadir Matrícula):**
        *   Recupera la matrícula y el tipo de lista (`whitelist`, `blacklist`, `supplier`).
        *   Inserta o actualiza la matrícula en la tabla `vehicles`. Utiliza `ON DUPLICATE KEY UPDATE` para manejar matrículas existentes.
        *   Si la matrícula se añade a la lista blanca (`whitelist`) y se seleccionan cámaras, intenta añadir la matrícula a las cámaras LPR seleccionadas utilizando `addPlateToCameraWhitelist()` de `api_helpers.php`.
        *   Almacena mensajes de éxito o error.
    *   **`delete_plate` (Eliminar Matrícula):**
        *   Recupera el ID del vehículo a eliminar.
        *   Si la matrícula a eliminar está en la lista blanca, intenta eliminarla de *todas* las cámaras LPR configuradas utilizando `deletePlateFromCameraWhitelist()` de `api_helpers.php`.
        *   Elimina la matrícula de la tabla `vehicles`.
        *   Almacena mensajes de éxito o error.
    *   Después de procesar cualquier acción POST, redirige a la misma página para evitar el reenvío del formulario y mostrar los mensajes.

3.  **Obtención de Datos (GET):**
    *   Determina la lista actual a mostrar (`whitelist`, `blacklist`, `supplier`, `all`) a partir del parámetro `list` en la URL.
    *   Implementa paginación: calcula el número total de registros y el offset para la consulta SQL.
    *   Aplica filtros de búsqueda por matrícula/propietario y por lote.
    *   Realiza una consulta SQL compleja para obtener los vehículos de la lista seleccionada, incluyendo el nombre del propietario y los lotes asociados.
    *   Obtiene una lista de todas las cámaras configuradas para el modal de añadir matrícula.

### Frontend (HTML/CSS/JavaScript)

1.  **Navegación por Pestañas:**
    *   Utiliza un diseño de pestañas tipo "píldora" para navegar entre "Lista Blanca", "Lista Negra", "Proveedores" y "Todos".

2.  **Tabla de Matrículas:**
    *   Muestra las matrículas en una tabla con columnas para Matrícula, Propietario, Lote(s) y, si se está viendo "Todos", el Tipo de Lista.
    *   Cada fila incluye un botón "Eliminar" que abre un modal de confirmación.

3.  **Paginación:**
    *   Incluye controles de paginación para navegar por los resultados.

4.  **Modales Interactivos:**
    *   **Modal "Añadir Matrícula":**
        *   Permite introducir una nueva matrícula y asignarla a una lista.
        *   Si se selecciona "Lista Blanca", muestra una sección para elegir las cámaras con las que sincronizar la matrícula.
    *   **Modal "Confirmar Eliminación":**
        *   Pide confirmación antes de eliminar una matrícula.
        *   Advierte que la eliminación también intentará sincronizarse con las cámaras.
    *   **Modal "Buscar y Filtrar":**
        *   Permite aplicar filtros por matrícula/propietario y por lote.

5.  **Menú de Acción Flotante (FAB):**
    *   Un botón FAB en la esquina inferior derecha que, al hacer clic, expande un menú con opciones para "Añadir Matrícula" y "Buscar / Filtrar".

## Dependencias

*   `config.php`: Para la configuración general y funciones CSRF.
*   `api_helpers.php`: Para las funciones `addPlateToCameraWhitelist()` y `deletePlateFromCameraWhitelist()`.
*   `includes/pagination_controls.php`: Para la renderización de los controles de paginación.
*   `style.css`, `includes/css/menu.css`, `includes/css/modals.css`, `includes/css/toast.css`: Estilos de la aplicación.