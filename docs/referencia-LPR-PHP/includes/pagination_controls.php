<?php
/**
 * includes/pagination_controls.php
 *
 * Renderiza los controles de paginación.
 * Asume que las siguientes variables están definidas en el script que lo incluye:
 * - $total_pages
 * - $current_page
 * - $total_records
 */
?>
<style>
    /* Los estilos pueden ir en style.css, pero los dejo aquí para que sea autocontenido */
    .pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 0.5rem 0; flex-wrap: wrap; gap: 1rem; border-top: 1px solid var(--border-color); }
    .pagination-info { color: var(--secondary-text-color); font-size: 0.9em; }
    .pagination-links { display: flex; list-style-type: none; padding: 0; margin: 0; gap: 0.5rem; }
    .pagination-links a, .pagination-links span { display: inline-block; padding: 0.5rem 0.8rem; border: 1px solid var(--border-color); border-radius: var(--border-radius); color: var(--primary-color); text-decoration: none; transition: background-color 0.2s, color 0.2s; }
    .pagination-links a:hover { background-color: var(--primary-color-light); color: #fff; }
    .pagination-links .active { background-color: var(--primary-color); color: #fff; font-weight: bold; cursor: default; border-color: var(--primary-color); }
    .pagination-links .disabled { color: var(--disabled-color); background-color: var(--background-color); border-color: var(--disabled-color); cursor: not-allowed; }
    .pagination-links .dots { border: none; }
</style>

<?php if (isset($total_pages) && $total_pages > 1): ?>
    <div class="pagination-container">
        <div class="pagination-info">
            Página <strong><?php echo $current_page; ?></strong> de <strong><?php echo $total_pages; ?></strong> (<?php echo $total_records; ?> resultados totales)
        </div>
        <nav class="pagination-links">
            <?php
            // Construir la URL base manteniendo todos los parámetros GET actuales excepto el de la página 'p'.
            $query_params = $_GET; 
            unset($query_params['p']);
            $base_url = 'index.php?' . http_build_query($query_params) . '&p=';
            
            // Botón "Anterior"
            echo $current_page > 1 ? '<a href="' . $base_url . ($current_page - 1) . '">« Anterior</a>' : '<span class="disabled">« Anterior</span>';

            // Lógica de números de página con elipsis (...) para no mostrar todos los números
            $window = 1; // Cuántos enlaces mostrar alrededor de la página actual
            for ($i = 1; $i <= $total_pages; $i++) {
                if ($i == 1 || $i == $total_pages || ($i >= $current_page - $window && $i <= $current_page + $window)) {
                    echo '<a href="' . $base_url . $i . '" class="' . ($i == $current_page ? 'active' : '') . '">' . $i . '</a>';
                } elseif ($i == $current_page - $window - 1 || $i == $current_page + $window + 1) {
                    echo '<span class="dots disabled">...</span>';
                }
            }
            
            // Botón "Siguiente"
            echo $current_page < $total_pages ? '<a href="' . $base_url . ($current_page + 1) . '">Siguiente »</a>' : '<span class="disabled">Siguiente »</span>';
            ?>
        </nav>
    </div>
<?php endif; ?>