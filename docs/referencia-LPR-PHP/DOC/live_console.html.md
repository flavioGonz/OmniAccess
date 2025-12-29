# Documentación de `live_console.html`

## Descripción General

`live_console.html` es la interfaz de usuario para la visualización en tiempo real de los eventos de matrículas capturadas por el sistema LPR. Presenta una "consola" en vivo con tres carruseles de imágenes: uno central para la última captura general y dos laterales para las capturas específicas de cámaras de "entrada" y "salida". La página se actualiza periódicamente para mostrar los eventos más recientes.

## Flujo de Operación

### Interfaz de Usuario (HTML/CSS)

*   **Diseño de Tres Columnas:** La página se organiza en un diseño de tres columnas:
    *   **Columna Izquierda (`entrada-column`):** Muestra un carrusel de las últimas capturas de cámaras de "entrada".
    *   **Columna Central (`center-column`):** Muestra un carrusel de la última captura general (de cualquier cámara).
    *   **Columna Derecha (`salida-column`):** Muestra un carrusel de las últimas capturas de cámaras de "salida".
*   **Carruseles de Imágenes:** Cada carrusel muestra la imagen de la matrícula, el número de matrícula, la decisión (permitido/denegado), el propietario, el nombre de la cámara y la fecha/hora del evento.
*   **Mensajes de No Captura:** Si no hay eventos para una categoría específica, se muestra un mensaje indicándolo.

### Funcionalidad JavaScript

1.  **`fetchEvents()`:**
    *   Función asíncrona que realiza una petición `fetch` a `get_live_data.php`.
    *   Recupera los últimos eventos en formato JSON.
    *   Maneja posibles errores de red o de parseo JSON.
    *   Almacena todos los eventos en la variable `allEvents` y luego llama a `renderEvents()`.

2.  **`renderEvents()`:**
    *   Filtra los `allEvents` en dos arrays separados: `eventsEntradaData` y `eventsSalidaData`, basándose en si el `device_name` incluye "entrada" o "salida" (comparación insensible a mayúsculas/minúsculas).
    *   Llama a `renderAllCarousels()` para actualizar la interfaz.

3.  **`renderSingleCarousel(container, eventsData, currentIndex, noCaptureMessageElement)`:**
    *   Función genérica para renderizar un carrusel individual.
    *   Limpia el contenido actual del carrusel.
    *   Si no hay datos, muestra el mensaje de "no capturas" y oculta el carrusel.
    *   Si hay datos, ajusta el `currentIndex` para asegurar que esté dentro de los límites del array `eventsData`.
    *   Crea un elemento `div` para el evento, le asigna clases CSS para el estilo (ej. color de fondo según la decisión).
    *   Construye el HTML interno del elemento del carrusel con la imagen de la matrícula y la información del evento.
    *   Habilita/deshabilita los botones de navegación del carrusel según si hay más de un evento.
    *   Devuelve el `currentIndex` ajustado.

4.  **`renderAllCarousels()`:**
    *   Coordina la renderización de los tres carruseles llamando a `renderSingleCarousel` para cada uno:
        *   El carrusel central (`latestCaptureCarousel`) muestra `allEvents`.
        *   El carrusel de entrada (`carouselEntrada`) muestra `eventsEntradaData`.
        *   El carrusel de salida (`carouselSalida`) muestra `eventsSalidaData`.

5.  **Navegación de Carruseles:**
    *   Se añaden `event listeners` a los botones "anterior" y "siguiente" de cada carrusel para permitir la navegación manual entre los eventos.

6.  **Actualización en Tiempo Real:**
    *   `fetchEvents()` se llama inicialmente al cargar la página (`DOMContentLoaded`).
    *   `setInterval(fetchEvents, 2000)`: Configura una actualización automática de los eventos cada 2 segundos, manteniendo la consola en vivo.

## Dependencias

*   `get_live_data.php`: Endpoint de backend que proporciona los datos de eventos en tiempo real.
*   `style.css`: Para los estilos generales de la aplicación.
*   Font Awesome (CDN): Para los iconos utilizados en la interfaz.