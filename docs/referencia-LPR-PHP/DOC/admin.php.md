# Documentación de `admin.php`

## Descripción General

`admin.php` es una página de administración autocontenida que permite a los usuarios realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar) sobre los vehículos registrados en el sistema LPR. La página presenta un formulario para añadir o editar vehículos y una tabla que lista todos los vehículos existentes en la base de datos.

Esta página combina lógica de backend (PHP) y una interfaz de usuario (HTML/CSS/JavaScript) en un solo archivo.

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Incluye `config.php` para obtener las credenciales de la base de datos.
    *   Establece una conexión a la base de datos MySQL utilizando PDO. Si la conexión falla, el script termina y muestra un error.

2.  **Manejo de Peticiones POST (Añadir/Editar):**
    *   Verifica si la solicitud es de tipo `POST`.
    *   Recupera y limpia los datos del formulario: `plate`, `description`, `is_whitelisted` y `vehicle_id`.
    *   **Edición:** Si `vehicle_id` es mayor que 0, el script actualiza el registro existente en la tabla `vehicles` con los nuevos datos.
    *   **Inserción:** Si `vehicle_id` es 0, el script intenta insertar un nuevo registro en la tabla `vehicles`.
        *   Maneja posibles errores de base de datos, como una matrícula duplicada (error con código `23000`), mostrando un mensaje de error específico.
    *   Almacena un mensaje de éxito o error en la variable `$message` para mostrarlo al usuario.

3.  **Manejo de Peticiones GET (Eliminar):**
    *   Verifica si la URL contiene los parámetros `action=delete` y un `id` de vehículo.
    *   Si se cumplen las condiciones, ejecuta una consulta `DELETE` para eliminar el vehículo correspondiente de la tabla `vehicles`.
    *   Muestra un mensaje de confirmación al usuario mediante JavaScript antes de proceder con la eliminación.
    *   Almacena un mensaje de éxito o error en la variable `$message`.

4.  **Obtención de Datos para Visualización:**
    *   Realiza una consulta `SELECT` para obtener todos los vehículos de la tabla `vehicles`, ordenados por matrícula (`plate`).
    *   Almacena los resultados en la variable `$vehicles`.

## Interfaz de Usuario (HTML)

*   **Formulario de Añadir/Editar:**
    *   Un formulario que permite introducir la matrícula, una descripción y si el vehículo está en la lista blanca (`is_whitelisted`).
    *   Un campo oculto `vehicle_id` se utiliza para distinguir entre una operación de inserción (valor 0) y una de edición (valor > 0).
*   **Tabla de Vehículos:**
    *   Muestra una lista de todos los vehículos registrados con su matrícula, descripción y estado en la lista blanca.
    *   Para cada vehículo, ofrece dos acciones:
        *   **Editar:** Un enlace que, mediante la función JavaScript `editVehicle()`, rellena el formulario de arriba con los datos del vehículo seleccionado para su edición.
        *   **Eliminar:** Un enlace que redirige a la misma página con los parámetros de eliminación, activando la lógica de borrado en el backend.

## Funcionalidad JavaScript

*   **`editVehicle(id, plate, description, is_whitelisted)`:**
    *   Esta función se llama al hacer clic en el enlace "Editar".
    *   Rellena los campos del formulario (`vehicle_id`, `plate`, `description`, `is_whitelisted`) con los datos del vehículo seleccionado.
    *   Desplaza la página hacia arriba para que el formulario sea visible.

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.