# Documentación de `logout.php`

## Descripción General

`logout.php` es una página de confirmación visual que informa al usuario que su sesión ha sido cerrada. Aunque el archivo en sí no contiene la lógica PHP para destruir la sesión (se asume que esta lógica se maneja en `auth.php` o similar), sirve como una página de aterrizaje amigable después de que el usuario ha decidido salir de la aplicación.

## Contenido

*   **HTML Básico:** Una estructura HTML estándar con cabecera, cuerpo y pie de página.
*   **Mensaje de Confirmación:** Muestra un título "Cerrar Sesión" y un párrafo "Has cerrado tu sesión correctamente."
*   **Navegación:** Incluye un enlace "Volver al Inicio" que redirige a `index.php`.

## Flujo de Usuario

1.  El usuario hace clic en el enlace "Salir" (normalmente en el menú de navegación).
2.  La acción de cierre de sesión (ej. destruir la sesión PHP) se ejecuta en un script de backend (como `auth.php?action=logout`).
3.  Una vez que la sesión ha sido destruida, el usuario es redirigido a `logout.php` para ver la confirmación.
4.  El usuario puede hacer clic en "Volver al Inicio" para regresar a la página principal (que lo redirigirá a `login.php` si no está autenticado).

## Dependencias

*   `style.css`: Para los estilos básicos de la página.