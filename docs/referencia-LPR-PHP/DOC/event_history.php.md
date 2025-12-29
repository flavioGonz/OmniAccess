# Documentación de `event_history.php`

## Descripción General

`event_history.php` es el módulo principal para visualizar y gestionar el historial de eventos de matrículas capturadas por el sistema LPR. Ofrece funcionalidades de paginación, filtrado avanzado por diversos criterios (matrícula, propietario, lote, cámara, rango de fechas) y una opción para purgar completamente el historial de eventos y las imágenes asociadas.

Este script está diseñado para ser incluido por `index.php` y asume que ya existe una conexión PDO a la base de datos (`$pdo`).

## Flujo de Operación

### Backend (PHP)

1.  **Configuración Inicial:**
    *   Establece la zona horaria a `America/Argentina/Buenos_Aires`.
    *   Genera un token CSRF para proteger la operación de purga.

2.  **Paginación:**
    *   Define el número de elementos por página (`$items_per_page`).
    *   Calcula la página actual (`$current_page`) y el offset para la consulta SQL.

3.  **Filtros de Búsqueda:**
    *   Recupera los parámetros de filtro de la URL (`$_GET`): `plate`, `owner`, `lot`, `device`, `date_from`, `date_to`.
    *   Construye dinámicamente las cláusulas `WHERE` y `HAVING` para la consulta SQL basándose en los filtros aplicados.
    *   **Nota:** El filtro `device` permite buscar por cámaras de 'entrada' o 'salida' basándose en el nombre del dispositivo.

4.  **Consulta a la Base de Datos:**
    *   Realiza dos consultas principales:
        *   Una para contar el total de registros que coinciden con los filtros (`COUNT(DISTINCT e.id)`), lo que permite calcular el número total de páginas.
        *   Otra para obtener los eventos específicos de la página actual, incluyendo información de la matrícula, propietario, lote y cámara, y la ruta de la imagen capturada.
    *   Las consultas utilizan `LEFT JOIN` para combinar datos de las tablas `events`, `vehicles`, `owners`, `devices`, `owner_lot_associations` y `lots`.

### Frontend (HTML/CSS/JavaScript)

1.  **Tabla de Eventos:**
    *   Muestra los eventos en una tabla con columnas para Fecha y Hora, Matrícula, Propietario, Lote, Cámara, Decisión (permitido/denegado) y una miniatura de la captura de imagen.
    *   Si no hay eventos o los filtros no arrojan resultados, muestra un mensaje informativo.

2.  **Paginación:**
    *   Muestra controles de paginación en la parte inferior de la tabla, permitiendo navegar entre las páginas de resultados.
    *   Incluye información sobre la página actual, el total de páginas y el total de resultados.

3.  **Modal de Filtros:**
    *   Un botón "Abrir Filtros" (parte del menú FAB) abre un modal con un formulario para aplicar filtros de búsqueda.
    *   Permite al usuario introducir criterios para filtrar por matrícula, propietario, lote, tipo de cámara y rango de fechas.
    *   Un botón "Limpiar Filtros" restablece todos los campos de filtro.

4.  **Modal de Purga de Eventos:**
    *   Un botón "Purgar Historial de Eventos" (parte del menú FAB) abre un modal de confirmación.
    *   **Advertencia:** Muestra una advertencia clara sobre la naturaleza irreversible de la acción, que eliminará todos los eventos, imágenes y sesiones de estacionamiento.
    *   Requiere que el usuario escriba la palabra "BORRAR" para habilitar el botón de confirmación.
    *   Al confirmar, realiza una petición AJAX a `purge_events.php`.

5.  **Menú de Acción Flotante (FAB - Floating Action Button):**
    *   Un botón principal (`+`) que, al hacer clic, expande un menú con acciones adicionales como "Abrir Filtros" y "Purgar Historial de Eventos".

## Dependencias

*   `config.php`: Para la configuración de la base de datos y las funciones CSRF.
*   `purge_events.php`: Script de backend para ejecutar la operación de purga.
*   `style.css`: Para los estilos de la interfaz de usuario.