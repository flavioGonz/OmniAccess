<?php
/**
 * manage_access_lists.php (Versión Final con Filtros Visibles y Estilizados)
 */

echo '<link rel="stylesheet" href="includes/css/dashboard.css">';

// PARTE 1: CONTROLADOR (LÓGICA PHP)
global $pdo, $csrf_token;
require_once __DIR__ . '/api_helpers.php'; 

if ($_SERVER['REQUEST_METHOD'] === 'POST' && validate_csrf_token($_POST['csrf_token'] ?? '')) {
    $action = $_POST['action'] ?? '';
    $success_messages = $_SESSION['success_messages'] ?? [];
    $error_messages = $_SESSION['error_messages'] ?? [];
    if ($action === 'add_plate' || $action === 'edit_plate') {
        $plate = strtoupper(trim(preg_replace('/[^A-Z0-9]/i', '', $_POST['plate'] ?? '')));
        $list_type = $_POST['list_type'] ?? 'whitelist';
        $owner_id = empty($_POST['owner_id']) ? null : $_POST['owner_id'];
        $is_whitelisted = ($list_type === 'whitelist') ? 1 : 0;
        $vehicle_id = $_POST['vehicle_id'] ?? null;
        if (!empty($plate)) {
            try {
                if ($action === 'edit_plate' && !empty($vehicle_id)) {
                    $stmt = $pdo->prepare("UPDATE vehicles SET plate = :plate, list_type = :list_type, is_whitelisted = :is_whitelisted, owner_id = :owner_id, updated_at = NOW() WHERE id = :id");
                    $stmt->execute([':plate' => $plate, ':list_type' => $list_type, ':is_whitelisted' => $is_whitelisted, ':owner_id' => $owner_id, ':id' => $vehicle_id]);
                    $success_messages[] = "Matrícula '{$plate}' actualizada correctamente.";
                } else {
                    $stmt = $pdo->prepare("INSERT INTO vehicles (plate, list_type, is_whitelisted, owner_id, created_at, updated_at) VALUES (:plate, :list_type, :is_whitelisted, :owner_id, NOW(), NOW()) ON DUPLICATE KEY UPDATE list_type = :list_type, is_whitelisted = :is_whitelisted, owner_id = :owner_id, updated_at = NOW()");
                    $stmt->execute([':plate' => $plate, ':list_type' => $list_type, ':is_whitelisted' => $is_whitelisted, ':owner_id' => $owner_id]);
                    $success_messages[] = "Matrícula '{$plate}' guardada en la lista '{$list_type}'.";
                }
            } catch (PDOException $e) { $error_messages[] = "Error de base de datos: " . $e->getMessage(); }
        } else { $error_messages[] = "La matrícula no puede estar vacía."; }
    }
    if ($action === 'delete_plate') {
        $vehicle_id = $_POST['vehicle_id_to_delete'] ?? '';
        if(!empty($vehicle_id)){
             try {
                $stmt = $pdo->prepare("SELECT plate, list_type FROM vehicles WHERE id = :id");
                $stmt->execute([':id' => $vehicle_id]);
                $vehicle = $stmt->fetch();
                if ($vehicle) {
                    $plate_to_delete = $vehicle['plate'];
                    if ($vehicle['list_type'] === 'whitelist') {
                        $all_cameras = $pdo->query("SELECT id, name, ip, username, password FROM devices")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($all_cameras as $camera) {
                            @deletePlateFromCameraWhitelist($camera, $plate_to_delete);
                        }
                    }
                    $delete_stmt = $pdo->prepare("DELETE FROM vehicles WHERE id = :id");
                    $delete_stmt->execute([':id' => $vehicle_id]);
                    $success_messages[] = "Matrícula '{$plate_to_delete}' eliminada de la base de datos local.";
                }
            } catch (PDOException $e) { $error_messages[] = "Error de base de datos al eliminar: " . $e->getMessage(); }
        }
    }
    $_SESSION['success_messages'] = $success_messages;
    $_SESSION['error_messages'] = $error_messages;
    header('Location: ' . $_SERVER['REQUEST_URI']);
    exit();
}

$message = $_SESSION['success_messages'] ?? [];
$error_message = $_SESSION['error_messages'] ?? [];
unset($_SESSION['success_messages'], $_SESSION['error_messages']);

$current_list = $_GET['list'] ?? 'whitelist';
$search_plate_owner = $_GET['search_po'] ?? '';
$search_lot = $_GET['search_lot'] ?? '';

$items_per_page = 20;
$current_page = max(1, (int)($_GET['p'] ?? 1));
$select_sql = "SELECT v.id, v.plate, v.list_type, v.created_at, v.owner_id, o.name as owner_name, (SELECT MAX(e.timestamp) FROM events e WHERE e.plate = v.plate) as last_capture";
$base_sql = "FROM vehicles v LEFT JOIN owners o ON v.owner_id = o.id LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id LEFT JOIN lots l ON ola.lot_id = l.id";
$where_clauses = [];
$having_clauses = [];
$params = [];
if ($current_list !== 'all') { $where_clauses[] = "v.list_type = :list_type"; $params[':list_type'] = $current_list; }
if (!empty($search_plate_owner)) { $where_clauses[] = "(v.plate LIKE :search_po OR o.name LIKE :search_po)"; $params[':search_po'] = "%" . $search_plate_owner . "%"; }
if (!empty($search_lot)) { $having_clauses[] = "GROUP_CONCAT(l.description SEPARATOR ', ') LIKE :search_lot"; $params[':search_lot'] = "%" . $search_lot . "%"; }
$sql_where = !empty($where_clauses) ? " WHERE " . implode(" AND ", $where_clauses) : "";
$sql_having = !empty($having_clauses) ? " HAVING " . implode(" AND ", $having_clauses) : "";
$sql_group_by = " GROUP BY v.id";
$count_sql = "SELECT COUNT(*) FROM (SELECT v.id $base_sql $sql_where $sql_group_by $sql_having) AS subquery";
$count_stmt = $pdo->prepare($count_sql);
$count_stmt->execute($params);
$total_records = (int) $count_stmt->fetchColumn();
$total_pages = $total_records > 0 ? ceil($total_records / $items_per_page) : 0;
if ($current_page > $total_pages && $total_pages > 0) $current_page = $total_pages;
$offset = ($current_page - 1) * $items_per_page;
$data_sql = "$select_sql $base_sql $sql_where $sql_group_by $sql_having ORDER BY v.created_at DESC LIMIT :limit OFFSET :offset";
$stmt = $pdo->prepare($data_sql);
foreach ($params as $key => &$val) $stmt->bindParam($key, $val);
$stmt->bindValue(':limit', $items_per_page, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);
$owners_list = $pdo->query("SELECT id, name FROM owners ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
$is_filtered = !empty($search_plate_owner) || !empty($search_lot);
?>

<!-- PARTE 2: VISTA (HTML) -->
<h1>Gestión de Listas de Acceso</h1>

<?php if (!empty($message)): ?><div class="message success"><ul><?php foreach ($message as $msg): ?><li><?= htmlspecialchars($msg) ?></li><?php endforeach; ?></ul></div><?php endif; ?>
<?php if (!empty($error_message)): ?><div class="message error"><ul><?php foreach ($error_message as $error): ?><li><?= htmlspecialchars($error) ?></li><?php endforeach; ?></ul></div><?php endif; ?>

<div class="pill-nav">
    <a href="?page=access_lists&list=whitelist" class="<?= $current_list == 'whitelist' ? 'active' : '' ?>">Lista Blanca</a>
    <a href="?page=access_lists&list=blacklist" class="<?= $current_list == 'blacklist' ? 'active' : '' ?>">Lista Negra</a>
    <a href="?page=access_lists&list=supplier" class="<?= $current_list == 'supplier' ? 'active' : '' ?>">Proveedores</a>
    <a href="?page=access_lists&list=all" class="<?= $current_list == 'all' ? 'active' : '' ?>">Todos</a>
</div>

<div class="filter-bar widget">
    <form action="index.php" method="GET" class="filter-form">
        <input type="hidden" name="page" value="access_lists">
        <input type="hidden" name="list" value="<?= htmlspecialchars($current_list) ?>">
        <div class="form-group">
            <i class="fas fa-search"></i>
            <input type="text" name="search_po" placeholder="Buscar por Matrícula o Propietario..." value="<?= htmlspecialchars($search_plate_owner) ?>" class="form-control">
        </div>
        <div class="form-group">
             <i class="fas fa-layer-group"></i>
            <input type="text" name="search_lot" placeholder="Filtrar por Lote..." value="<?= htmlspecialchars($search_lot) ?>" class="form-control">
        </div>
        <button type="submit" class="btn btn-primary">Buscar</button>
        <?php if ($is_filtered): ?>
            <a href="index.php?page=access_lists&list=<?= $current_list ?>" class="btn btn-secondary">Limpiar</a>
        <?php endif; ?>
    </form>
</div>

<section class="data-section">
    <table>
        <thead>
            <tr>
                <th>Matrícula</th>
                <th>Propietario</th>
                <th>Lista</th>
                <th style="width: 25%;">Estado en Cámaras</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($vehicles)): ?>
                <tr><td colspan="5" style="text-align: center; padding: 2rem;">No se encontraron matrículas.</td></tr>
            <?php else: ?>
                <?php foreach ($vehicles as $vehicle): ?>
                    <tr data-vehicle-id="<?= $vehicle['id'] ?>" data-plate="<?= htmlspecialchars($vehicle['plate']) ?>" data-list-type="<?= htmlspecialchars($vehicle['list_type']) ?>" data-owner-id="<?= htmlspecialchars($vehicle['owner_id'] ?? '') ?>">
                        <td>
                            <a href="#" class="plate-history-link" title="Ver historial de esta matrícula">
                                <div class="styled-plate-mercosur">
                                    <div class="plate-inner">
                                        <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                                        <div class="plate-number"><?= htmlspecialchars($vehicle['plate']) ?></div>
                                    </div>
                                </div>
                            </a>
                        </td>
                        <td><?= htmlspecialchars($vehicle['owner_name'] ?? 'No Asignado') ?></td>
                        <td><span class="badge list-type-<?= htmlspecialchars($vehicle['list_type']) ?>"><?= ucfirst(htmlspecialchars($vehicle['list_type'])) ?></span></td>
                        <td class="camera-status-cell">
                            <?php if ($vehicle['list_type'] === 'whitelist'): ?>
                                <div class="status-container" data-plate="<?= htmlspecialchars($vehicle['plate']) ?>">
                                    <button class="btn btn-secondary btn-sm check-status-btn"><i class="fas fa-search"></i> Verificar</button>
                                </div>
                            <?php else: ?>
                                <span style="color: var(--secondary-text-color);">N/A</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <button class="btn btn-secondary btn-sm edit-plate-btn"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn btn-danger btn-sm open-delete-modal-btn"><i class="fas fa-trash"></i> Eliminar</button>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>
    <?php include __DIR__ . '/includes/pagination_controls.php'; ?>
</section>

<div id="plateModal" class="modal"><div class="modal-content-wrapper"><form action="?page=access_lists&list=<?= $current_list ?>" method="POST"><input type="hidden" name="action" id="plate_action" value="add_plate"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="vehicle_id" id="vehicle_id"><div class="modal-header"><h2 id="plateModalTitle">Añadir Matrícula</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="plate">Matrícula:</label><input type="text" id="plate" name="plate" class="form-control" required style="text-transform: uppercase;"></div><div class="form-group"><label for="owner_id">Propietario (Opcional):</label><select id="owner_id" name="owner_id" class="form-control"><option value="">-- Sin propietario --</option><?php foreach ($owners_list as $owner) { echo '<option value="' . $owner['id'] . '">' . htmlspecialchars($owner['name']) . '</option>'; } ?></select></div><div class="form-group"><label for="list_type">Tipo de Lista:</label><select id="list_type" name="list_type" class="form-control"><option value="whitelist">Lista Blanca</option><option value="blacklist">Lista Negra</option><option value="supplier">Proveedores</option></select></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div></form></div></div>

<div id="deletePlateModal" class="modal"><div class="modal-content-wrapper"><form action="?page=access_lists&list=<?= $current_list ?>" method="POST"><input type="hidden" name="action" value="delete_plate"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="vehicle_id_to_delete" id="vehicleIdToDeleteInput"><div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div><div class="modal-body"><p>¿Estás seguro que deseas eliminar la matrícula <strong id="plateToDeleteSpan" class="styled-plate-mercosur" style="display: inline-block;"></strong> de forma permanente?</p><p class="message warning" style="margin-top: 1rem;"><small>Esta acción también intentará eliminar la matrícula de TODAS las cámaras LPR configuradas.</small></p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar Eliminación</button></div></form></div></div>

<div id="historyModal" class="modal"><div class="modal-content-wrapper"><div class="modal-header"><h2 id="historyModalTitle">Historial de Matrícula</h2><span class="close-button">×</span></div><div class="modal-body" id="historyModalBody"><p>Cargando historial...</p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cerrar</button></div></div></div>

<div id="syncPlateModal" class="modal"><div class="modal-content-wrapper"><div class="modal-header"><h2>Sincronizar Matrícula</h2><span class="close-button">×</span></div><div class="modal-body"><p>Seleccione las cámaras a las que desea enviar la matrícula <strong id="syncPlateLabel" class="styled-plate-mercosur" style="display: inline-block;"></strong>:</p><form id="sync-plate-form"><input type="hidden" id="sync-plate-value" name="plate"><div id="sync-camera-list" class="camera-checkbox-group"></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="button" id="confirm-sync-btn" class="btn btn-primary"><i class="fas fa-sync-alt"></i> Sincronizar Ahora</button></div><div id="sync-result-log" class="log-box" style="margin-top: 1rem; display: none; height: 150px;"></div></div></div>

<div class="fab-container"><ul class="fab-options"><li><span class="fab-label">Añadir Matrícula</span><button class="fab-secondary" id="openAddPlateModalBtn" title="Añadir nueva matrícula"><i class="fas fa-plus"></i></button></li></ul><button class="fab-main" title="Añadir Matrícula"><i class="fas fa-plus"></i></button></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // --- LÓGICA DEL FAB (SIMPLIFICADO) ---
    const fabMain = document.querySelector('.fab-main');
    if (fabMain) {
        fabMain.addEventListener('click', () => {
            document.getElementById('openAddPlateModalBtn').click();
        });
    }

    // --- MANEJADOR DE EVENTOS PRINCIPAL PARA TODA LA PÁGINA ---
    const plateModal = document.getElementById('plateModal');
    const deleteModal = document.getElementById('deletePlateModal');
    const historyModal = document.getElementById('historyModal');
    const syncModal = document.getElementById('syncPlateModal');

    // Botón del FAB para abrir modal de AÑADIR
    document.getElementById('openAddPlateModalBtn').addEventListener('click', () => {
        plateModal.querySelector('form').reset();
        plateModal.querySelector('#plateModalTitle').textContent = 'Añadir Matrícula';
        plateModal.querySelector('#plate_action').value = 'add_plate';
        plateModal.querySelector('#vehicle_id').value = '';
        plateModal.style.display = 'flex';
    });

    // Delegación de eventos en el cuerpo de la tabla
    document.querySelector('table tbody').addEventListener('click', async function(e) {
        const target = e.target;
        const button = target.closest('button');
        const historyLink = target.closest('.plate-history-link');
        const row = target.closest('tr');
        if (!row) return;

        if (button && button.classList.contains('edit-plate-btn')) {
            plateModal.querySelector('form').reset();
            plateModal.querySelector('#plateModalTitle').textContent = 'Editar Matrícula';
            plateModal.querySelector('#plate_action').value = 'edit_plate';
            plateModal.querySelector('#vehicle_id').value = row.dataset.vehicleId;
            plateModal.querySelector('#plate').value = row.dataset.plate;
            plateModal.querySelector('#list_type').value = row.dataset.listType;
            plateModal.querySelector('#owner_id').value = row.dataset.ownerId;
            plateModal.style.display = 'flex';
        }
        
        if (button && button.classList.contains('open-delete-modal-btn')) {
            deleteModal.querySelector('#vehicleIdToDeleteInput').value = row.dataset.vehicleId;
            deleteModal.querySelector('#plateToDeleteSpan').innerHTML = `<div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${row.dataset.plate}</div></div>`;
            deleteModal.style.display = 'flex';
        }

        if (historyLink) {
            e.preventDefault();
            const plate = row.dataset.plate;
            historyModal.querySelector('#historyModalTitle').innerHTML = `Historial de <div class="styled-plate-mercosur" style="display: inline-block; vertical-align: middle; transform: scale(0.8); margin-left: 10px;"><div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${plate}</div></div></div>`;
            const modalBody = historyModal.querySelector('#historyModalBody');
            modalBody.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Cargando historial...</p>';
            historyModal.style.display = 'flex';
            try {
                const response = await fetch(`get_plate_history.php?plate=${plate}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error de red');
                if (result.success && result.data.length > 0) {
                    let tableHtml = '<table class="compact"><thead><tr><th>Fecha/Hora</th><th>Decisión</th><th>Cámara</th></tr></thead><tbody>';
                    result.data.forEach(event => {
                        let decisionClass = event.decision.includes('permitido') ? 'decision-green' : 'decision-red';
                        let deviceName = event.device_name || 'Desconocida';
                        let eventDate = new Date(event.timestamp.replace(' ', 'T'));
                        let formattedDate = eventDate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                        tableHtml += `<tr><td>${formattedDate}</td><td><span class="badge ${decisionClass}">${event.decision}</span></td><td>${deviceName}</td></tr>`;
                    });
                    modalBody.innerHTML = tableHtml + '</tbody></table>';
                } else { modalBody.innerHTML = `<p>${result.success ? 'No se encontraron eventos.' : 'Error: ' + result.message}</p>`; }
            } catch (error) {
                modalBody.innerHTML = '<p class="message error">Error al cargar el historial. Revise la consola.</p>';
                console.error('Error en fetch:', error);
            }
        }
        
        if (button && button.classList.contains('check-status-btn')) {
            const container = button.parentElement;
            const plate = container.dataset.plate;
            container.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Comprobando...`;
            try {
                const response = await fetch(`check_plate_on_cameras.php?plate=${plate}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error de red');
                if (result.success) {
                    let html = '', missing_cameras = [];
                    result.data.forEach(cam => {
                        let statusClass = 'offline', title = 'Cámara offline o no responde';
                        if (cam.is_online) {
                            if (cam.is_present) { statusClass = 'synced'; title = 'Matrícula presente'; } 
                            else { statusClass = 'missing'; title = 'Matrícula no encontrada'; missing_cameras.push(cam); }
                        }
                        html += `<span class="sync-badge ${statusClass}" title="${title}">${cam.camera_name}</span>`;
                    });
                    if (missing_cameras.length > 0) {
                        html += `<button class="btn btn-secondary btn-sm sync-now-btn" data-plate="${plate}" data-missing='${JSON.stringify(missing_cameras)}'>Sincronizar</button>`;
                    }
                    container.innerHTML = html;
                } else { container.innerHTML = `<span style="color:var(--decision-red);">Error</span> <button class="btn btn-secondary btn-sm check-status-btn">Reintentar</button>`; }
            } catch (error) { container.innerHTML = `<span style="color:var(--decision-red);">Error de red</span> <button class="btn btn-secondary btn-sm check-status-btn">Reintentar</button>`; }
        }

        if (button && button.classList.contains('sync-now-btn')) {
            const plate = button.dataset.plate;
            const missingCameras = JSON.parse(button.dataset.missing);
            document.getElementById('syncPlateLabel').innerHTML = `<div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${plate}</div></div>`;
            document.getElementById('sync-plate-value').value = plate;
            let cameraCheckboxesHtml = '<label class="checkbox-container select-all-label"><strong>Seleccionar Todas</strong><input type="checkbox" id="sync-select-all"><span class="checkmark"></span></label><hr>';
            missingCameras.forEach(cam => {
                if (cam.is_online) { cameraCheckboxesHtml += `<label class="checkbox-container">${cam.camera_name}<input type="checkbox" name="sync_cameras[]" value="${cam.camera_id}" checked><span class="checkmark"></span></label>`; }
            });
            document.getElementById('sync-camera-list').innerHTML = cameraCheckboxesHtml;
            document.getElementById('sync-result-log').style.display = 'none';
            document.getElementById('sync-result-log').innerHTML = '';
            syncModal.style.display = 'flex';

            const syncSelectAll = document.getElementById('sync-select-all');
            if (syncSelectAll) {
                syncSelectAll.addEventListener('change', function() {
                    syncModal.querySelectorAll('input[name="sync_cameras[]"]').forEach(cb => cb.checked = this.checked);
                });
            }
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelectorAll('.close-button').forEach(button => { button.addEventListener('click', () => modal.style.display = 'none'); });
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    });

    const confirmSyncBtn = document.getElementById('confirm-sync-btn');
    if (confirmSyncBtn) {
        confirmSyncBtn.addEventListener('click', async function() {
            this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
            const syncResultLog = document.getElementById('sync-result-log');
            syncResultLog.style.display = 'block'; syncResultLog.innerHTML = '';
            const plate = document.getElementById('sync-plate-value').value;
            const selectedCameras = Array.from(syncModal.querySelectorAll('input[name="sync_cameras[]"]:checked')).map(cb => cb.value);

            if (selectedCameras.length === 0) {
                logSyncResult('Debe seleccionar al menos una cámara.', 'error');
                this.disabled = false; this.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Ahora'; return;
            }

            const response = await fetch('process_camera_sync.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', plate: plate, camera_ids: selectedCameras }) });
            const result = await response.json();

            if (result.success) { result.details.forEach(detail => logSyncResult(`[${detail.camera_name}] ${detail.message}`, detail.success ? 'success' : 'error')); } 
            else { logSyncResult(`Error general: ${result.message}`, 'error'); }
            
            this.disabled = false; this.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Ahora';
            
            const statusContainer = document.querySelector(`.status-container[data-plate="${plate}"]`);
            if (statusContainer) {
                const checkBtn = statusContainer.querySelector('.check-status-btn') || document.createElement('button');
                checkBtn.className = 'btn btn-secondary btn-sm check-status-btn';
                statusContainer.innerHTML = '';
                statusContainer.appendChild(checkBtn);
                checkBtn.click();
            }
        });
    }

    function logSyncResult(message, type) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${message}`;
        document.getElementById('sync-result-log').appendChild(entry);
    }
});
</script>