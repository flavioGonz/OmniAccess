# Documentación de `api_tester.php`

## Descripción General

`api_tester.php` es una herramienta de desarrollo y depuración que proporciona una interfaz web para enviar peticiones personalizadas a la API ISAPI de las cámaras Hikvision. Permite a los desarrolladores probar diferentes endpoints, métodos HTTP y cuerpos de petición sin necesidad de escribir código o usar herramientas externas como Postman.

La página está diseñada como un "laboratorio" donde se pueden construir y enviar peticiones de forma interactiva y ver la respuesta completa de la cámara, incluyendo el código de estado HTTP, las cabeceras y el cuerpo de la respuesta.

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Carga `config.php` para las credenciales de la base de datos.
    *   Se conecta a la base de datos para obtener una lista de las cámaras guardadas en la tabla `devices`. Esto permite al usuario seleccionar una cámara guardada para las pruebas.

2.  **Manejo de Peticiones POST:**
    *   Cuando el usuario envía el formulario, el script procesa la petición `POST`.
    *   **Selección de Conexión:** Determina si el usuario ha elegido usar una cámara guardada de la base de datos o ha introducido los datos de conexión (IP, usuario, contraseña) manualmente.
    *   **Construcción de la Petición cURL:**
        *   Ensambla la URL completa a partir de la IP de la cámara y el endpoint proporcionado.
        *   Configura una sesión de cURL con los parámetros necesarios, incluyendo:
            *   La URL de destino.
            *   Autenticación `DIGEST` con el usuario y contraseña.
            *   El método HTTP (GET, POST, PUT, DELETE).
            *   El cuerpo de la petición (si lo hay).
    *   **Ejecución y Respuesta:**
        *   Ejecuta la petición cURL.
        *   Captura la respuesta completa, separando el código de estado HTTP, las cabeceras y el cuerpo.
        *   Maneja posibles errores de cURL.

## Interfaz de Usuario (HTML)

*   **Sección de Construcción de Petición:**
    *   **Tipo de Conexión:** Permite elegir entre una "Cámara Guardada" (seleccionada de un desplegable) o una "Conexión Manual" (introduciendo los datos directamente).
    *   **Endpoints Predefinidos:** Un menú desplegable con una lista de peticiones comunes (ej. obtener la hora, abrir la barrera, añadir/eliminar matrícula) que rellenan automáticamente los campos del formulario.
    *   **Endpoint de la API:** Un campo de texto para introducir la ruta del endpoint de la API (ej. `/ISAPI/System/time`).
    *   **Método HTTP:** Un selector para elegir el método (GET, POST, PUT, DELETE).
    *   **Cuerpo de la Petición:** Un área de texto para introducir el cuerpo de la petición (normalmente en formato XML o JSON).
*   **Sección de Resultado:**
    *   Esta sección solo se muestra después de enviar una petición.
    *   Muestra la URL completa que se utilizó.
    *   Muestra el código de estado HTTP de la respuesta (coloreado en verde para éxito y rojo para error).
    *   Muestra las cabeceras y el cuerpo de la respuesta de la cámara, formateando el XML para una mejor legibilidad.

## Funcionalidad JavaScript

*   **Alternar Campos de Conexión:** Oculta o muestra los campos para la conexión manual o la selección de base de datos según la opción elegida por el usuario.
*   **Rellenar Endpoints Predefinidos:** Cuando el usuario selecciona una opción del menú de endpoints predefinidos, el script rellena automáticamente los campos de endpoint, método y cuerpo de la petición con los valores correspondientes.

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.
*   `style.css`: Para los estilos generales de la página.