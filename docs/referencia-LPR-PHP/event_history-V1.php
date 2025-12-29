<?php
/**
 * event_history.php - Módulo de Historial de Eventos con Paginación y Purga
 *
 * Este script es incluido por index.php y asume que la variable $pdo
 * ya existe y está conectada a la base de datos.
 */

// Asegura la zona horaria para funciones de fecha/hora de PHP (como time() y date())
date_default_timezone_set('America/Argentina/Buenos_Aires');

// --- NUEVO: Generar token CSRF para el borrado ---
// Nota: 'config.php' ya está cargado por 'index.php', así que las funciones de sesión y CSRF están disponibles.
$csrf_token = generate_csrf_token();
// --- FIN NUEVO ---


// --- 1. CONFIGURACIÓN DE PAGINACIÓN ---
$items_per_page = 25;
$current_page = isset($_GET['p']) && is_numeric($_GET['p']) ? (int)$_GET['p'] : 1;
if ($current_page < 1) {
    $current_page = 1;
}

// --- 2. LÓGICA DE BÚSQUEDA Y FILTROS ---
$search_plate = $_GET['plate'] ?? '';
$search_owner = $_GET['owner'] ?? '';
$search_lot = $_GET['lot'] ?? '';
$search_device = $_GET['device'] ?? '';
$search_date_from = $_GET['date_from'] ?? '';
$search_date_to = $_GET['date_to'] ?? '';

$base_sql = "FROM events e 
             LEFT JOIN vehicles v ON e.vehicle_id = v.id 
             LEFT JOIN owners o ON v.owner_id = o.id 
             LEFT JOIN devices d ON e.device_id = d.id 
             LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id 
             LEFT JOIN lots l ON ola.lot_id = l.id";
$where_clauses = [];
$having_clauses = [];
$params = [];

if (!empty($search_plate)) { $where_clauses[] = "e.plate LIKE :plate"; $params[':plate'] = "%" . $search_plate . "%"; }
if (!empty($search_owner)) { $where_clauses[] = "o.name LIKE :owner_name"; $params[':owner_name'] = "%" . $search_owner . "%"; }
if (!empty($search_lot)) { $having_clauses[] = "GROUP_CONCAT(DISTINCT l.description SEPARATOR ', ') LIKE :lot_description"; $params[':lot_description'] = "%" . $search_lot . "%"; }
if (!empty($search_device)) { 
    if ($search_device === 'entrada') { $where_clauses[] = "d.name LIKE '%entrada%'"; } 
    elseif ($search_device === 'salida') { $where_clauses[] = "d.name LIKE '%salida%'"; } 
}
if (!empty($search_date_from)) { 
    $where_clauses[] = "e.timestamp >= :date_from"; 
    $params[':date_from'] = $search_date_from . " 00:00:00";
}
if (!empty($search_date_to)) { 
    $where_clauses[] = "e.timestamp <= :date_to"; 
    $params[':date_to'] = $search_date_to . " 23:59:59";
}


$sql_where = !empty($where_clauses) ? " WHERE " . implode(" AND ", $where_clauses) : "";
$sql_having = !empty($having_clauses) ? " HAVING " . implode(" AND ", $having_clauses) : "";

// --- 3. OBTENER EL TOTAL DE REGISTROS PARA LA PAGINACIÓN ---
$count_sql = "SELECT COUNT(DISTINCT e.id) $base_sql $sql_where $sql_having";
$count_stmt = $pdo->prepare($count_sql);

foreach ($params as $key => $val) {
    if (strpos($key, 'lot_description') === false) {
        $count_stmt->bindValue($key, $val);
    }
}
$count_stmt->execute();
$total_records = (int) $count_stmt->fetchColumn();
$total_pages = $total_records > 0 ? ceil($total_records / $items_per_page) : 0;

if ($current_page > $total_pages && $total_pages > 0) $current_page = $total_pages;
$offset = ($current_page - 1) * $items_per_page;

// --- 4. OBTENER LOS REGISTROS PARA LA PÁGINA ACTUAL ---
$data_sql = "SELECT e.id, e.plate, e.timestamp, e.image_path, e.decision, o.name as owner_name, d.name as device_name, GROUP_CONCAT(DISTINCT l.description SEPARATOR ', ') as lot_description 
             $base_sql $sql_where GROUP BY e.id $sql_having ORDER BY e.id DESC LIMIT :limit OFFSET :offset";
$stmt = $pdo->prepare($data_sql);

foreach ($params as $key => &$val) {
    $stmt->bindParam($key, $val);
}
$stmt->bindValue(':limit', $items_per_page, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$events = $stmt->fetchAll();

$is_filtered = !empty(array_filter([$search_plate, $search_owner, $search_lot, $search_device, $search_date_from, $search_date_to]));
?>
<style>
    .pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 0.5rem 0; flex-wrap: wrap; gap: 1rem; border-top: 1px solid var(--border-color); }
    .pagination-info { color: var(--secondary-text-color); font-size: 0.9em; }
    .pagination-links { display: flex; list-style-type: none; padding: 0; margin: 0; gap: 0.5rem; }
    .pagination-links a, .pagination-links span { display: inline-block; padding: 0.5rem 0.8rem; border: 1px solid var(--border-color); border-radius: var(--border-radius); color: var(--primary-color); text-decoration: none; transition: background-color 0.2s, color 0.2s; }
    .pagination-links a:hover { background-color: var(--primary-color-light); color: #fff; }
    .pagination-links .active { background-color: var(--primary-color); color: #fff; font-weight: bold; cursor: default; border-color: var(--primary-color); }
    .pagination-links .disabled { color: var(--disabled-color); background-color: var(--background-color); border-color: var(--disabled-color); cursor: not-allowed; }
    .pagination-links .dots { border: none; }

    .plate-capture-thumbnail {
        width: 100px;
        height: auto;
        object-fit: cover;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        vertical-align: middle;
    }

    /* NUEVO: Estilos para el menú FAB */
    .fab-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 1000; }
    .fab-main { width: 56px; height: 56px; border-radius: 50%; background-color: var(--primary-color); color: white; border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: transform 0.3s ease; }
    .fab-main:hover { transform: scale(1.1); }
    .fab-main.active { transform: rotate(45deg); }
    .fab-menu { display: flex; flex-direction: column; align-items: center; margin-bottom: 1rem; transform: scaleY(0); transform-origin: bottom; transition: transform 0.3s ease; }
    .fab-container.active .fab-menu { transform: scaleY(1); }
    .fab-action { width: 48px; height: 48px; border-radius: 50%; background-color: var(--surface-color); color: var(--text-color); border: 1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 0.75rem; transition: transform 0.2s; }
    .fab-action:hover { transform: scale(1.1); background-color: var(--primary-color-light); color: white; }
</style>

<!-- NUEVO: Input oculto para el token CSRF -->
<input type="hidden" id="csrf-token-value" value="<?= htmlspecialchars($csrf_token); ?>">

<h1>Historial de Eventos</h1>

<section class="data-section">
    <h2>
        Resultados
        <?php if ($is_filtered): ?>
            <small style="font-weight: 400; color: var(--secondary-text-color);">(Filtros aplicados)</small>
        <?php endif; ?>
    </h2>

    <table>
        <thead>
            <tr>
                <th>Fecha y Hora</th><th>Matrícula</th><th>Propietario</th><th>Lote</th><th>Cámara</th><th>Decisión</th><th>Captura</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($events)): ?>
                <tr><td colspan="7" style="text-align:center; padding: 2rem;">No se encontraron eventos. <?php echo $is_filtered ? 'Pruebe a cambiar o limpiar los filtros.' : ''; ?></td></tr>
            <?php else: ?>
                <?php foreach ($events as $event): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($event['timestamp']); ?></td> 
                        <td><span class="styled-plate"><?php echo htmlspecialchars($event['plate']); ?></span></td>
                        <td><?php echo htmlspecialchars($event['owner_name'] ?? 'N/A'); ?></td>
                        <td><?php echo htmlspecialchars($event['lot_description'] ?? 'N/A'); ?></td>
                        <td><?php echo htmlspecialchars($event['device_name'] ?? 'N/A'); ?></td>
                        <td><span class="decision-<?php echo strpos($event['decision'], 'permitido') !== false ? 'green' : 'red'; ?>-text"><?php echo htmlspecialchars(ucwords(str_replace('_', ' ', $event['decision']))); ?></span></td>
                        <td>
                            <?php 
                            $full_image_path = !empty($event['image_path']) ? '/LPR/' . $event['image_path'] : '';
                            $file_system_path = APP_ROOT . '/' . $event['image_path'];
                            ?>
                            <?php if (!empty($full_image_path) && file_exists($file_system_path)): ?>
                                <a href="<?php echo htmlspecialchars($full_image_path); ?>" target="_blank"><img src="<?php echo htmlspecialchars($full_image_path); ?>" class="plate-capture-thumbnail" alt="Captura de matrícula"></a>
                            <?php else: ?> N/A <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>

    <?php if ($total_pages > 1): ?>
        <div class="pagination-container">
            <div class="pagination-info">
                Página <strong><?php echo $current_page; ?></strong> de <strong><?php echo $total_pages; ?></strong> (<?php echo $total_records; ?> resultados totales)
            </div>
            <nav class="pagination-links">
                <?php
                $query_params = $_GET; unset($query_params['p']);
                $base_url = 'index.php?' . http_build_query($query_params) . '&p=';
                
                echo $current_page > 1 ? '<a href="' . $base_url . ($current_page - 1) . '">« Anterior</a>' : '<span class="disabled">« Anterior</span>';

                $window = 1;
                $start_page = max(1, $current_page - $window);
                $end_page = min($total_pages, $current_page + $window);

                if ($start_page > 1) {
                    echo '<a href="' . $base_url . '1">1</a>';
                    if ($start_page > 2) { echo '<span class="dots">...</span>'; }
                }

                for ($i = $start_page; $i <= $end_page; $i++) {
                    echo '<a href="' . $base_url . $i . '" class="' . ($i == $current_page ? 'active' : '') . '">' . $i . '</a>';
                }

                if ($end_page < $total_pages) {
                    if ($end_page < $total_pages - 1) { echo '<span class="dots">...</span>'; }
                    echo '<a href="' . $base_url . $total_pages . '">' . $total_pages . '</a>';
                }

                echo $current_page < $total_pages ? '<a href="' . $base_url . ($current_page + 1) . '">Siguiente »</a>' : '<span class="disabled">Siguiente »</span>';
                ?>
            </nav>
        </div>
    <?php endif; ?>
</section>

<div id="filter-modal" class="modal">
    <div class="modal-content-wrapper">
        <form action="index.php" method="GET">
            <input type="hidden" name="page" value="event_history">
            <div class="modal-header">
                <h2>Filtros de Búsqueda</h2>
                <span class="close-button">×</span>
            </div>
            <div class="modal-body">
                <div class="filter-grid">
                    <div class="form-group"><label for="plate">Matrícula:</label><input type="text" name="plate" id="plate" value="<?php echo htmlspecialchars($search_plate); ?>" class="form-control"></div>
                    <div class="form-group"><label for="owner">Propietario:</label><input type="text" name="owner" id="owner" value="<?php echo htmlspecialchars($search_owner); ?>" class="form-control"></div>
                    <div class="form-group"><label for="lot">Lote:</label><input type="text" name="lot" id="lot" value="<?php echo htmlspecialchars($search_lot); ?>" class="form-control"></div>
                    <div class="form-group"><label for="device">Tipo de Cámara:</label><select name="device" id="device" class="form-control"><option value="">Todas</option><option value="entrada" <?php if($search_device === 'entrada') echo 'selected'; ?>>Solo Entradas</option><option value="salida" <?php if($search_device === 'salida') echo 'selected'; ?>>Solo Salidas</option></select></div>
                    <div class="form-group"><label for="date_from">Desde:</label><input type="date" name="date_from" id="date_from" value="<?php echo htmlspecialchars($search_date_from); ?>" class="form-control"></div>
                    <div class="form-group"><label for="date_to">Hasta:</label><input type="date" name="date_to" id="date_to" value="<?php echo htmlspecialchars($search_date_to); ?>" class="form-control"></div>
                </div>
            </div>
            <div class="modal-footer">
                <a href="index.php?page=event_history" class="btn btn-secondary">Limpiar Filtros</a>
                <button type="submit" class="btn btn-primary">Aplicar Filtros</button>
            </div>
        </form>
    </div>
</div>

<!-- MODAL DE PURGA DE EVENTOS - ¡NUEVO! -->
<div id="purgeEventsModal" class="modal" style="display:none;">
    <div class="modal-content-wrapper"> <!-- Usando tu clase wrapper para consistencia -->
        <div class="modal-header">
            <h2><i class="fas fa-exclamation-triangle" style="color: #f1c40f;"></i> Confirmar Purga Total</h2>
            <span class="close-button">×</span>
        </div>
        <div class="modal-body">
            <p><strong>¡ADVERTENCIA!</strong> Esta acción es <strong>permanente e irreversible</strong>.</p>
            <p>Está a punto de eliminar:</p>
            <ul>
                <li><strong>TODOS</strong> los registros de eventos de la base de datos.</li>
                <li><strong>TODAS</strong> las imágenes de matrículas capturadas.</li>
                <li><strong>TODOS</strong> los registros de sesiones de estacionamiento.</li>
            </ul>
            <p>Para confirmar, por favor escriba la palabra <strong>BORRAR</strong> en el siguiente campo:</p>
            <input type="text" id="purge-confirm-input" class="form-control" autocomplete="off" placeholder="Escriba BORRAR aquí">
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-button">Cancelar</button>
            <button type="button" id="confirm-purge-btn" class="btn btn-danger" disabled>Sí, Eliminar Todo</button>
        </div>
    </div>
</div>

<!-- MODIFICADO: Contenedor FAB para soportar múltiples botones -->
<div class="fab-container">
    <div class="fab-menu">
        <button class="fab-action" id="purge-events-btn" title="Purgar Historial de Eventos">
            <i class="fas fa-trash-alt"></i>
        </button>
        <button class="fab-action" id="open-filter-modal-btn" title="Abrir Filtros">
            <i class="fas fa-filter"></i>
        </button>
    </div>
    <button class="fab-main" id="fab-main-toggle">
        <i class="fas fa-plus"></i>
    </button>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // --- LÓGICA DEL MENÚ FAB ---
    const fabContainer = document.querySelector('.fab-container');
    const fabMain = document.getElementById('fab-main-toggle');
    if(fabMain) {
        fabMain.addEventListener('click', () => {
            fabContainer.classList.toggle('active');
            fabMain.classList.toggle('active');
        });
    }

    // --- LÓGICA DEL MODAL DE FILTROS ---
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
        const openFilterBtn = document.getElementById('open-filter-modal-btn');
        const closeFilterBtns = filterModal.querySelectorAll('.close-button');

        openFilterBtn.addEventListener('click', () => { filterModal.style.display = 'flex'; });
        closeFilterBtns.forEach(btn => btn.addEventListener('click', () => { filterModal.style.display = 'none'; }));
        window.addEventListener('click', (event) => { if (event.target == filterModal) filterModal.style.display = 'none'; });
    }

    // --- LÓGICA PARA EL MODAL DE PURGA ---
    const purgeModal = document.getElementById('purgeEventsModal');
    if (purgeModal) {
        const openPurgeBtn = document.getElementById('purge-events-btn');
        const closePurgeBtns = purgeModal.querySelectorAll('.close-button');
        const confirmInput = document.getElementById('purge-confirm-input');
        const finalPurgeBtn = document.getElementById('confirm-purge-btn');
        const csrfToken = document.getElementById('csrf-token-value').value;
        
        openPurgeBtn.addEventListener('click', () => {
            purgeModal.style.display = 'flex';
        });

        closePurgeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                purgeModal.style.display = 'none';
                confirmInput.value = '';
                finalPurgeBtn.disabled = true;
            });
        });
        
        window.addEventListener('click', (event) => { if (event.target == purgeModal) purgeModal.style.display = 'none'; });

        confirmInput.addEventListener('input', () => {
            finalPurgeBtn.disabled = confirmInput.value.trim() !== 'BORRAR';
        });

        finalPurgeBtn.addEventListener('click', async () => {
            finalPurgeBtn.disabled = true;
            finalPurgeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

            try {
                const response = await fetch('purge_events.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ csrf_token: csrfToken })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    alert(result.message + `\n\nResumen:\n- Eventos en DB: ${result.db_events_deleted}\n- Sesiones en DB: ${result.db_sessions_deleted}\n- Archivos de imagen: ${result.files_deleted}`);
                    window.location.href = 'index.php?page=event_history'; 
                } else {
                    throw new Error(result.message || 'Ocurrió un error desconocido.');
                }
            } catch (error) {
                alert('Error al procesar la solicitud: ' + error.message);
                finalPurgeBtn.innerHTML = 'Sí, Eliminar Todo';
                // No se re-habilita el botón a propósito para forzar al usuario a reintentar desde cero.
            }
        });
    }
});
</script>