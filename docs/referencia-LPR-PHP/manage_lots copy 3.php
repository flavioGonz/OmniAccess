<?php
/**
 * manage_lots.php (Versión 3.2 - Con Marcadores Arrastrables en el Mapa)
 */

echo '<link rel="stylesheet" href="includes/css/manage_lots.css">';

// PARTE 1: CONTROLADOR (LÓGICA PHP)
// ===============================================
global $pdo, $csrf_token;

// --- LÓGICA DE PROCESAMIENTO POST ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && validate_csrf_token($_POST['csrf_token'] ?? '')) {
    $action = $_POST['action'] ?? '';

    // ACCIONES SOBRE LOTES (Modificada para incluir coordenadas)
    if ($action === 'save_lot') {
        $lot_id = $_POST['lot_id'] ?? null;
        $description = trim($_POST['description'] ?? '');
        $lot_uid = trim($_POST['lot_uid'] ?? '');
        $latitude = !empty($_POST['latitude']) ? trim($_POST['latitude']) : null;
        $longitude = !empty($_POST['longitude']) ? trim($_POST['longitude']) : null;

        if (!empty($description)) {
            try {
                if (!empty($lot_id)) { // Editar lote
                    $stmt = $pdo->prepare("UPDATE lots SET description = :description, lot_uid = :lot_uid, latitude = :lat, longitude = :lon WHERE id = :id");
                    $stmt->execute([':description' => $description, ':lot_uid' => $lot_uid, ':lat' => $latitude, ':lon' => $longitude, ':id' => $lot_id]);
                    $_SESSION['success_message'] = "Lote actualizado con éxito.";
                } else { // Añadir nuevo lote
                    $stmt = $pdo->prepare("INSERT INTO lots (description, lot_uid, latitude, longitude, created_at) VALUES (:description, :lot_uid, :lat, :lon, NOW())");
                    $stmt->execute([':description' => $description, ':lot_uid' => $lot_uid, ':lat' => $latitude, ':lon' => $longitude]);
                    $_SESSION['success_message'] = "Lote '{$description}' añadido con éxito.";
                }
            } catch (PDOException $e) {
                $_SESSION['error_message'] = "Error de base de datos: " . $e->getMessage();
            }
        } else {
            $_SESSION['error_message'] = "La descripción del lote no puede estar vacía.";
        }
    } elseif ($action === 'delete_lot') {
        $lot_id_to_delete = $_POST['lot_id_to_delete'] ?? null;
        if ($lot_id_to_delete) {
            $stmt = $pdo->prepare("DELETE FROM lots WHERE id = :id");
            $stmt->execute([':id' => $lot_id_to_delete]);
            $_SESSION['success_message'] = "Lote eliminado permanentemente.";
        }
    } 
    // ACCIONES SOBRE ASOCIACIONES
    elseif ($action === 'assign_owner') {
        $lot_id = $_POST['lot_id_for_owner'] ?? null;
        $owner_id = $_POST['owner_to_assign'] ?? null;
        if ($lot_id && $owner_id) {
            $stmt = $pdo->prepare("INSERT INTO owner_lot_associations (owner_id, lot_id) VALUES (:owner_id, :lot_id)");
            $stmt->execute([':owner_id' => $owner_id, ':lot_id' => $lot_id]);
            $_SESSION['success_message'] = "Propietario asignado al lote.";
        } else {
            $_SESSION['error_message'] = "Faltan datos para asignar el propietario.";
        }
    } elseif ($action === 'unassign_owner') {
        $association_id_to_unassign = $_POST['association_id_to_unassign'] ?? null;
        if ($association_id_to_unassign) {
            list($owner_id, $lot_id) = explode('-', $association_id_to_unassign);
            $stmt = $pdo->prepare("DELETE FROM owner_lot_associations WHERE owner_id = :owner_id AND lot_id = :lot_id");
            $stmt->execute([':owner_id' => $owner_id, ':lot_id' => $lot_id]);
            $_SESSION['success_message'] = "Propietario desvinculado del lote.";
        }
    }
    
    // REDIRECCIÓN
    $redirect_url = 'index.php?page=manage_lots';
    if (isset($_POST['lot_id_for_owner'])) {
        $redirect_url .= '&manage_owners_for=' . $_POST['lot_id_for_owner'];
    }
    header('Location: ' . $redirect_url);
    exit();
}

// --- LÓGICA GET PARA PREPARAR DATOS Y TOASTS ---
$toast_message = null;
$toast_type = 'success';

if (isset($_SESSION['success_message'])) { 
    $toast_message = $_SESSION['success_message']; 
    unset($_SESSION['success_message']); 
}
if (isset($_SESSION['error_message'])) { 
    $toast_message = $_SESSION['error_message']; 
    $toast_type = 'error';
    unset($_SESSION['error_message']); 
}

$search_term = $_GET['search'] ?? '';
$where_sql = !empty($search_term) ? "WHERE l.description LIKE :search OR l.lot_uid LIKE :search" : "";
$params = !empty($search_term) ? [':search' => "%" . $search_term . "%"] : [];
$sql = "SELECT l.id, l.description, l.lot_uid, l.latitude, l.longitude, COUNT(ola.owner_id) AS owner_count FROM lots l LEFT JOIN owner_lot_associations ola ON l.id = ola.lot_id $where_sql GROUP BY l.id, l.description, l.lot_uid, l.latitude, l.longitude ORDER BY l.description ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$lots = $stmt->fetchAll(PDO::FETCH_ASSOC);
$devices = $pdo->query("SELECT name, purpose, latitude, longitude FROM devices WHERE latitude IS NOT NULL AND longitude IS NOT NULL")->fetchAll(PDO::FETCH_ASSOC);
$owners_of_lot = [];
$unassigned_owners = [];
$lot_in_modal = null;
if (isset($_GET['manage_owners_for'])) {
    $lot_id_to_manage = $_GET['manage_owners_for'];
    $stmt = $pdo->prepare("SELECT id, description FROM lots WHERE id = :id");
    $stmt->execute([':id' => $lot_id_to_manage]);
    $lot_in_modal = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($lot_in_modal) {
        $stmt = $pdo->prepare("SELECT o.id, o.name FROM owners o JOIN owner_lot_associations ola ON o.id = ola.owner_id WHERE ola.lot_id = :id ORDER BY o.name ASC");
        $stmt->execute([':id' => $lot_id_to_manage]);
        $owners_of_lot = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt = $pdo->prepare("SELECT id, name FROM owners WHERE id NOT IN (SELECT owner_id FROM owner_lot_associations WHERE lot_id = :id) ORDER BY name ASC");
        $stmt->execute([':id' => $lot_id_to_manage]);
        $unassigned_owners = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>

<!-- PARTE 2: VISTA (HTML) -->
<h1 class="page-title" style="padding-left: 1.5rem; padding-right: 1.5rem;">Centro de Comando de Lotes</h1>
<input type="hidden" id="csrf-token-value" value="<?= htmlspecialchars($csrf_token) ?>"> <!-- Token CSRF para JS -->

<div class="split-screen-layout">
    <div class="column-left">
        <section class="data-section widget">
            <div class="widget-header">
                <h2 class="widget-title"><i class="fas fa-parking"></i> Lotes Registrados</h2>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th>UID</th>
                            <th>Propietarios</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($lots)): ?>
                            <tr><td colspan="4" style="text-align: center;">No hay lotes registrados.</td></tr>
                        <?php else: ?>
                            <?php foreach ($lots as $lot): ?>
                                <tr id="lot-row-<?= $lot['id'] ?>" data-lot-id="<?= $lot['id'] ?>" data-lot-description="<?= htmlspecialchars($lot['description']) ?>" data-lot-uid="<?= htmlspecialchars($lot['lot_uid'] ?? '') ?>" data-lat="<?= htmlspecialchars($lot['latitude'] ?? '') ?>" data-lon="<?= htmlspecialchars($lot['longitude'] ?? '') ?>">
                                    <td><a href="#" class="pan-to-map" title="Centrar en el mapa"><?= htmlspecialchars($lot['description']) ?></a></td>
                                    <td><?= htmlspecialchars($lot['lot_uid'] ?? 'N/A') ?></td>
                                    <td><span class="badge"><?= $lot['owner_count'] ?></span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm edit-lot-btn">Editar</button>
                                        <a href="?page=manage_lots&manage_owners_for=<?= $lot['id'] ?>" class="btn btn-primary btn-sm">Asignar</a>
                                        <button class="btn btn-danger btn-sm open-delete-modal-btn">Eliminar</button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
    <div class="column-right">
        <div id="lots-map"></div>
    </div>
</div>

<div id="lotModal" class="modal">
    <div class="modal-content-wrapper">
        <form action="index.php?page=manage_lots" method="POST">
            <input type="hidden" name="action" value="save_lot"><input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>"><input type="hidden" name="lot_id" id="lot_id">
            <div class="modal-header"><h2 id="lotModalTitle">Añadir Lote</h2><span class="close-button">×</span></div>
            <div class="modal-body">
                <div class="form-group"><label for="lot_description">Descripción:</label><input type="text" id="lot_description" name="description" class="form-control" required></div>
                <div class="form-group"><label for="lot_uid">UID del Lote (Opcional):</label><input type="text" id="lot_uid" name="lot_uid" class="form-control"></div>
                <div class="form-grid">
                    <div class="form-group"><label for="lot_latitude">Latitud (Opcional):</label><input type="text" id="lot_latitude" name="latitude" class="form-control" placeholder="Ej: -34.90716"></div>
                    <div class="form-group"><label for="lot_longitude">Longitud (Opcional):</label><input type="text" id="lot_longitude" name="longitude" class="form-control" placeholder="Ej: -54.83868"></div>
                </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
        </form>
    </div>
</div>

<div id="ownersModal" class="modal" <?php if ($lot_in_modal) echo 'style="display: flex;"'; ?>>
    <div class="modal-content-wrapper">
        <div class="modal-header"><h2 id="ownersModalTitle">Propietarios de <?= htmlspecialchars($lot_in_modal['description'] ?? '') ?></h2><a href="index.php?page=manage_lots" class="close-button" aria-label="Cerrar">×</a></div>
        <div class="modal-body">
            <h4>Propietarios Asignados</h4>
            <div id="assignedOwnersList" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                <?php if ($lot_in_modal && !empty($owners_of_lot)): ?>
                    <table class="compact">
                        <?php foreach ($owners_of_lot as $owner): ?>
                            <tr><td><?= htmlspecialchars($owner['name']) ?></td><td><form action="index.php?page=manage_lots" method="POST" style="display:inline;"><input type="hidden" name="action" value="unassign_owner"><input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>"><input type="hidden" name="association_id_to_unassign" value="<?= $owner['id'] . '-' . $lot_in_modal['id'] ?>"><input type="hidden" name="lot_id_for_owner" value="<?= $lot_in_modal['id'] ?>"><button type="submit" class="btn btn-danger btn-sm">Desvincular</button></form></td></tr>
                        <?php endforeach; ?>
                    </table>
                <?php else: ?><p>Este lote no tiene propietarios asignados.</p><?php endif; ?>
            </div><hr>
            <h4>Asignar Propietario Existente</h4>
            <form action="index.php?page=manage_lots" method="POST"><input type="hidden" name="action" value="assign_owner"><input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>"><input type="hidden" name="lot_id_for_owner" value="<?= $lot_in_modal['id'] ?? '' ?>"><div class="form-group"><label for="owner_to_assign">Seleccionar Propietario:</label><select name="owner_to_assign" id="owner_to_assign" class="form-control" required><option value="">-- Elija un propietario --</option><?php foreach ($unassigned_owners as $owner): ?><option value="<?= $owner['id'] ?>"><?= htmlspecialchars($owner['name']) ?></option><?php endforeach; ?></select></div><button type="submit" class="btn btn-primary" <?php if(empty($unassigned_owners)) echo 'disabled'; ?>>Asignar Propietario</button></form>
        </div>
        <div class="modal-footer"><a href="index.php?page=manage_lots" class="btn btn-secondary">Cerrar</a></div>
    </div>
</div>

<div id="deleteLotModal" class="modal"><div class="modal-content-wrapper"><form action="index.php?page=manage_lots" method="POST"><input type="hidden" name="action" value="delete_lot"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="lot_id_to_delete" id="lotIdToDeleteInput"><div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div><div class="modal-body"><p>¿Estás seguro que deseas eliminar el lote <strong id="lotDescriptionToDelete"></strong>?<br>Se eliminarán todas sus asociaciones con propietarios.</p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar Eliminación</button></div></form></div></div>

<div id="filterModal" class="modal"><div class="modal-content-wrapper"><form method="GET"><input type="hidden" name="page" value="manage_lots"><div class="modal-header"><h2>Buscar Lote</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="search_input">Buscar por Descripción o UID:</label><input type="text" name="search" id="search_input" class="form-control" value="<?php echo htmlspecialchars($search_term); ?>"></div></div><div class="modal-footer"><a href="index.php?page=manage_lots" class="btn btn-secondary">Limpiar</a><button type="submit" class="btn btn-primary">Buscar</button></div></form></div></div>

<div class="fab-container"><ul class="fab-options"><li><span class="fab-label">Añadir Lote</span><button class="fab-secondary" id="openAddLotModalBtn"><i class="fas fa-plus"></i></button></li><li><span class="fab-label">Buscar / Filtrar</span><button class="fab-secondary" id="openFilterModalBtn"><i class="fas fa-search"></i></button></li></ul><button class="fab-main"><i class="fas fa-plus"></i></button></div>

<?php if ($toast_message): ?>
<script>
    document.addEventListener('DOMContentLoaded', () => showToast('<?= addslashes(htmlspecialchars($toast_message)) ?>', '<?= $toast_type ?>'));
</script>
<?php endif; ?>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const fabMain = document.querySelector('.fab-main');
    const fabContainer = document.querySelector('.fab-container');
    if (fabMain) {
        fabMain.addEventListener('click', () => fabContainer.classList.toggle('active'));
    }

    const lotModal = document.getElementById('lotModal');
    const deleteLotModal = document.getElementById('deleteLotModal');
    const filterModal = document.getElementById('filterModal');
    
    document.getElementById('openAddLotModalBtn').addEventListener('click', () => {
        lotModal.querySelector('#lotModalTitle').textContent = 'Añadir Lote';
        lotModal.querySelector('form').reset();
        lotModal.querySelector('#lot_id').value = '';
        lotModal.style.display = 'flex';
    });
    
    document.getElementById('openFilterModalBtn').addEventListener('click', () => {
        filterModal.style.display = 'flex';
    });

    document.querySelector('table tbody').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;

        if (e.target.classList.contains('edit-lot-btn')) {
            lotModal.querySelector('#lotModalTitle').textContent = 'Editar Lote';
            lotModal.querySelector('#lot_id').value = row.dataset.lotId;
            lotModal.querySelector('#lot_description').value = row.dataset.lotDescription;
            lotModal.querySelector('#lot_uid').value = row.dataset.lotUid;
            lotModal.querySelector('#lot_latitude').value = row.dataset.lat;
            lotModal.querySelector('#lot_longitude').value = row.dataset.lon;
            lotModal.style.display = 'flex';
        }
        
        if (e.target.classList.contains('open-delete-modal-btn')) {
            deleteLotModal.querySelector('#lotIdToDeleteInput').value = row.dataset.lotId;
            deleteLotModal.querySelector('#lotDescriptionToDelete').textContent = row.dataset.lotDescription;
            deleteLotModal.style.display = 'flex';
        }

        if (e.target.classList.contains('pan-to-map')) {
            e.preventDefault();
            const lat = row.dataset.lat;
            const lon = row.dataset.lon;
            if (lat && lon && window.map) {
                window.map.flyTo([lat, lon], 18);
            } else {
                showToast('Este lote no tiene coordenadas asignadas.', 'error');
            }
        }
    });

    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const closeButtons = modal.querySelectorAll('.close-button');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (button.tagName !== 'A') e.preventDefault();
                if (modal.id === 'ownersModal') window.location.href = 'index.php?page=manage_lots';
                else modal.style.display = 'none';
            });
        });
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                if (modal.id === 'ownersModal') window.location.href = 'index.php?page=manage_lots';
                else modal.style.display = 'none';
            }
        });
    });

    const lotsData = <?= json_encode($lots) ?>;
    const devicesData = <?= json_encode($devices) ?>;
    const csrfToken = document.getElementById('csrf-token-value').value;
    const lotMarkers = {};

    if (document.getElementById('lots-map')) {
        window.map = L.map('lots-map').setView([-34.907, -54.838], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(window.map);

        const lotIcon = L.divIcon({ className: 'map-icon lot-icon', html: '<i class="fas fa-parking"></i>', iconSize: [24, 24] });
        const entryIcon = L.divIcon({ className: 'map-icon camera-icon entry', html: '<i class="fas fa-camera"></i>', iconSize: [24, 24] });
        const exitIcon = L.divIcon({ className: 'map-icon camera-icon exit', html: '<i class="fas fa-camera"></i>', iconSize: [24, 24] });
        const undefinedIcon = L.divIcon({ className: 'map-icon camera-icon undefined', html: '<i class="fas fa-camera"></i>', iconSize: [24, 24] });

        let bounds = [];
        lotsData.forEach(lot => {
            if (lot.latitude && lot.longitude) {
                const latLng = [lot.latitude, lot.longitude];
                const marker = L.marker(latLng, { 
                    icon: lotIcon,
                    draggable: true 
                }).addTo(window.map).bindPopup(`<b>Lote:</b> ${lot.description}`);
                
                lotMarkers[lot.id] = marker;
                
                marker.on('dragend', function(event) {
                    const newLatLng = event.target.getLatLng();
                    updateLotCoordinates(lot.id, newLatLng.lat, newLatLng.lng);
                });
                bounds.push(latLng);
            }
        });
        
        devicesData.forEach(device => {
            if (device.latitude && device.longitude) {
                const latLng = [device.latitude, device.longitude];
                let icon = device.purpose === 'entry' ? entryIcon : (device.purpose === 'exit' ? exitIcon : undefinedIcon);
                L.marker(latLng, { icon: icon }).addTo(window.map).bindPopup(`<b>Cámara:</b> ${device.name}`);
                bounds.push(latLng);
            }
        });

        if (bounds.length > 0) {
            window.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    async function updateLotCoordinates(lotId, lat, lng) {
        try {
            const response = await fetch('update_lot_coords.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lot_id: lotId,
                    lat: lat,
                    lng: lng,
                    csrf_token: csrfToken
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Error del servidor.');
            }
            if (result.success) {
                showToast(result.message, 'success');
                const row = document.getElementById(`lot-row-${lotId}`);
                if(row) {
                    row.dataset.lat = lat;
                    row.dataset.lon = lng;
                }
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast(`Error de red: ${error.message}`, 'error');
        }
    }
});
</script>