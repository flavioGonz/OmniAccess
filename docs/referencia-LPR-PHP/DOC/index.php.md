# Documentación de `index.php`

## Descripción General

`index.php` actúa como el controlador frontal principal de la aplicación ParkVision LPR System. Es el punto de entrada para todas las solicitudes de usuario y se encarga de cargar dinámicamente el contenido de la página solicitada basándose en el parámetro `page` de la URL. También gestiona la conexión a la base de datos, la inclusión de estilos y scripts globales, y la estructura general de la interfaz de usuario (cabecera, navegación, pie de página).

## Flujo de Operación

1.  **Configuración y Conexión a la BD:**
    *   Incluye `config.php`, que maneja el inicio de sesión, el guardián de autenticación y las constantes de la base de datos.
    *   Establece una conexión PDO a la base de datos MySQL. Si la conexión falla, muestra un mensaje de error crítico y termina la ejecución.

2.  **Determinación de la Página Actual:**
    *   Obtiene el valor del parámetro `page` de la URL (`$_GET['page']`).
    *   Si el parámetro `page` no está presente, por defecto se establece `dashboard` como la página actual.

3.  **Estructura HTML Base:**
    *   Define la estructura básica de la página HTML, incluyendo:
        *   Metadatos (`<meta>`).
        *   Título de la página (`<title>`).
        *   Inclusión de hojas de estilo CSS globales (`style.css`, `menu.css`, `modals.css`, `toast.css`).
        *   Inclusión de librerías CSS y JS externas (Leaflet.js, Chart.js, Font Awesome).
        *   La cabecera (`<header>`) con el logo, el menú de navegación principal y controles adicionales (reloj, menú hamburguesa).
        *   El área de contenido principal (`<main>`).
        *   El pie de página (`<footer>`).

4.  **Carga Dinámica de Contenido:**
    *   Define un array `$allowed_pages` que mapea los nombres de las páginas (obtenidos del parámetro `page`) a los archivos PHP o HTML correspondientes.
    *   Verifica si la `$currentPage` solicitada existe en el array `$allowed_pages`.
    *   Si la página es válida, incluye el archivo correspondiente (`include __DIR__ . '/' . $allowed_pages[$currentPage];`).
    *   Si la página no es válida o no se especifica, incluye `dashboard.php` como fallback seguro.

5.  **Carga de Scripts JavaScript:**
    *   Carga un script JavaScript global (`includes/js/main.js`) que contiene funcionalidades comunes (ej. menú, reloj).
    *   **Carga Condicional de Scripts Específicos:** Intenta cargar un script JavaScript con el mismo nombre que la página actual (ej. `dashboard.js` para `dashboard.php`). Esto permite que cada módulo tenga su propia lógica JavaScript sin cargar scripts innecesariamente.

## Navegación

El menú de navegación (`<nav>`) permite al usuario acceder a las diferentes secciones de la aplicación:

*   Dashboard
*   Eventos en Vivo
*   Historial
*   Gestión de Listas (con submenú para Listas de Acceso, Lotes, Propietarios y Vehículos)
*   Configuración (con submenú para Usuarios, Dispositivos LPR, Importar Datos, Visor de Logs y Salir)

## Dependencias

*   `config.php`: Fundamental para la configuración y seguridad.
*   `style.css`, `includes/css/menu.css`, `includes/css/modals.css`, `includes/css/toast.css`: Estilos de la aplicación.
*   Librerías externas: Chart.js, Leaflet.js, Font Awesome.
*   Scripts JavaScript: `includes/js/main.js` y scripts específicos de cada página (ej. `includes/js/dashboard.js`).
*   Todos los archivos PHP/HTML listados en `$allowed_pages`.