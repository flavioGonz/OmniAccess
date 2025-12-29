# Documentación de `style.css`

## Descripción General

`style.css` es la hoja de estilos principal de la aplicación ParkVision LPR System. Define el tema visual completo de la interfaz de usuario, siguiendo un estilo "Parking Industrial" con una paleta de colores oscuros, tipografías específicas y elementos de diseño que evocan un ambiente robusto y funcional. Este archivo es fundamental para la coherencia visual de toda la aplicación.

## Estructura y Contenido

El archivo CSS está organizado en varias secciones lógicas:

### 1. Variables CSS (`:root`)

*   Define una paleta de colores personalizada para el tema oscuro, incluyendo:
    *   Colores de fondo (`--background-color`, `--surface-color`, `--card-background`).
    *   Colores de texto (`--primary-text-color`, `--secondary-text-color`).
    *   Colores de bordes (`--border-color`, `--input-border`).
    *   Colores primarios de acción (`--primary-yellow`, `--primary-yellow-hover`).
    *   Colores de decisión (verde para éxito, rojo para error) con variantes para fondos y sombras (`--decision-green`, `--decision-red`, etc.).
    *   Colores para botones y mensajes (`--btn-secondary-bg`, `--message-success-bg`, etc.).
    *   Colores para el menú de navegación (`--nav-bg`, `--nav-link-color`).

### 2. Reseteo Básico y Estilos Globales

*   Define estilos básicos para `body` (fuente, color de fondo, color de texto, espaciado).
*   Estilos para encabezados (`h1` a `h6`) con tipografía y espaciado específicos.

### 3. Estilos del Encabezado Principal (`header`, `.main-header`)

*   Define el diseño y los colores de la barra de encabezado superior, que incluye el logo, el menú de navegación y los controles (reloj, botón de hamburguesa).
*   Estilos para inputs, selects y date pickers dentro del encabezado.

### 4. Estilos de la Consola en Vivo (`live_console.html`)

*   **Contenedor Principal (`.console-container`):** Define el diseño de tres columnas para la consola en vivo.
*   **Columnas de Eventos (`.event-column`, `.center-column`):** Estilos para las columnas de entrada, salida y la columna central de última captura.
*   **Mensajes de No Eventos (`.no-events-message`):** Estilos para cuando no hay capturas que mostrar.
*   **Contenedores de Imagen de Evento (`.event-image-container`):** Estilos para las tarjetas que muestran las imágenes de las matrículas, incluyendo efectos de hover y sombras.
*   **Colores de Decisión:** Clases para aplicar colores de fondo y sombras según la decisión (verde para permitido, rojo para denegado).
*   **Capas de Superposición (`.image-overlay`, `.carousel-info-overlay`):** Estilos para la información que se muestra sobre las imágenes de las matrículas, incluyendo el número de matrícula, decisión, propietario, cámara y fecha/hora.
*   **Estilo de Matrícula (`.styled-plate`):** Define la apariencia visual de los números de matrícula.
*   **Etiqueta de Cámara (`.camera-tag`):** Estilos para la etiqueta que indica la cámara.
*   **Estilos de Carrusel (`.carousel-container`, `.carousel-item`, `.carousel-image`, `.carousel-btn`):** Define la apariencia y el comportamiento de los carruseles de imágenes, incluyendo botones de navegación.

### 5. Estilos Generales para Páginas de Gestión

*   **Contenedor Principal (`.container`):** Estilos generales para los contenedores de contenido en las páginas de gestión.
*   **Secciones de Formulario y Datos (`.form-section`, `.data-section`):** Estilos para las secciones que contienen formularios y tablas.
*   **Grupos de Formulario (`.form-group`):** Estilos para las etiquetas y campos de entrada de formularios.
*   **Botones (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`):** Define la apariencia de los botones de la aplicación, incluyendo efectos de hover.
*   **Mensajes de Feedback (`.message`, `.message.success`, `.message.error`):** Estilos para los mensajes de éxito y error.
*   **Tablas (`table`, `th`, `td`):** Estilos para las tablas de datos, incluyendo encabezados y filas.

### 6. Estilos de Navegación Principal (Responsive)

*   Define la estructura y el comportamiento del menú de navegación principal, incluyendo:
    *   Diseño para escritorio y móvil (menú hamburguesa).
    *   Estilos para enlaces de navegación y dropdowns.
    *   Transiciones y animaciones para la apertura/cierre del menú móvil.

### 7. Estilos Específicos de Módulos

*   **Dashboard:** Estilos para las tarjetas de métricas (`.dashboard-card`) y los enlaces rápidos (`.quick-links`).
*   **Indicador de Estado (LED):** Estilos para los LEDs de estado de los dispositivos (`.status-led`), incluyendo animaciones de pulso.
*   **Notificaciones Toast:** Estilos para los mensajes de notificación emergentes (`.toast`).
*   **Historial de Eventos:** Estilos para la cuadrícula de filtros (`.filter-grid`) y los campos de fecha.
*   **Botón de Acción Flotante (FAB):** Estilos para el botón FAB y sus opciones secundarias, incluyendo animaciones de aparición y rotación.
*   **Panel de Filtros Deslizable:** Estilos para el panel de filtros que se desliza en la consola en vivo.
*   **Dropdowns y Campos de Fecha en Modales:** Estilos personalizados para los elementos `select` y `input[type="date"]` dentro de los modales, incluyendo iconos de Font Awesome.
*   **Paginación:** Estilos para los controles de paginación.
*   **Dashboard Enhancements:** Estilos para las tarjetas de estadísticas (`.kpi-card`) y el gráfico de ocupación.

### 8. Diseño Responsivo (`@media` queries)

*   Contiene reglas CSS para adaptar el diseño de la aplicación a diferentes tamaños de pantalla (tablets y móviles), ajustando el layout de columnas, el tamaño de los elementos y la navegación.

## Dependencias

*   Font Awesome (CDN): Utilizado para los iconos en toda la aplicación.
*   Google Fonts (Roboto, Roboto Condensed, Roboto Mono): Fuentes utilizadas para el tema visual.