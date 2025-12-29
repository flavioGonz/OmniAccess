<?php
// manage_lots.php (Versión 2.0 - Completa y Reestructurada)

require_once __DIR__ . '/config.php';
$csrf_token = generate_csrf_token();

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Error de conexión a la base de datos: " . $e->getMessage());
}

// --- LÓGICA DE PROCESAMIENTO POST (Añadir/Editar/Eliminar Lotes y Asociaciones) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validate_csrf_token($_POST['csrf_token'] ?? '')) {
        $_SESSION['error_message'] = "Error de seguridad (CSRF). Por favor, recargue y vuelva a intentarlo.";
    } else {
        $action = $_POST['action'] ?? '';

        // --- ACCIONES SOBRE LOTES ---
        if ($action === 'save_lot') {
            $lot_id = $_POST['lot_id'] ?? null;
            $description = trim($_POST['description'] ?? '');
            $lot_uid = trim($_POST['lot_uid'] ?? '');

            if (!empty($description)) {
                if (!empty($lot_id)) { // Editar lote
                    $stmt = $pdo->prepare("UPDATE lots SET description = :description, lot_uid = :lot_uid WHERE id = :id");
                    $stmt->execute([':description' => $description, ':lot_uid' => $lot_uid, ':id' => $lot_id]);
                    $_SESSION['success_message'] = "Lote actualizado con éxito.";
                } else { // Añadir nuevo lote
                    $stmt = $pdo->prepare("INSERT INTO lots (description, lot_uid, created_at) VALUES (:description, :lot_uid, NOW())");
                    $stmt->execute([':description' => $description, ':lot_uid' => $lot_uid]);
                    $_SESSION['success_message'] = "Lote '{$description}' añadido con éxito.";
                }
            } else {
                $_SESSION['error_message'] = "La descripción del lote no puede estar vacía.";
            }
        } elseif ($action === 'delete_lot') {
            $lot_id_to_delete = $_POST['lot_id_to_delete'] ?? null;
            if ($lot_id_to_delete) {
                // Se asume que la FK en la tabla `owner_lot_associations` tiene `ON DELETE CASCADE`
                $stmt = $pdo->prepare("DELETE FROM lots WHERE id = :id");
                $stmt->execute([':id' => $lot_id_to_delete]);
                $_SESSION['success_message'] = "Lote eliminado permanentemente.";
            }
        
        // --- ACCIONES SOBRE ASOCIACIONES ---
        } elseif ($action === 'assign_owner') {
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
    }
    
    $redirect_url = 'index.php?page=manage_lots';
    if (isset($_POST['lot_id_for_owner'])) {
        $redirect_url .= '&manage_owners_for=' . $_POST['lot_id_for_owner'];
    }
    header('Location: ' . $redirect_url);
    exit();
}

// --- LÓGICA GET PARA MOSTRAR DATOS ---
if (isset($_SESSION['success_message'])) { $message = $_SESSION['success_message']; unset($_SESSION['success_message']); }
if (isset($_SESSION['error_message'])) { $error_message = $_SESSION['error_message']; unset($_SESSION['error_message']); }

$search_term = $_GET['search'] ?? '';
$where_sql = "";
$params = [];
if (!empty($search_term)) {
    $where_sql = "WHERE l.description LIKE :search OR l.lot_uid LIKE :search";
    $params[':search'] = "%" . $search_term . "%";
}

$sql = "
    SELECT l.id, l.description, l.lot_uid, COUNT(ola.owner_id) AS owner_count
    FROM lots l
    LEFT JOIN owner_lot_associations ola ON l.id = ola.lot_id
    $where_sql
    GROUP BY l.id, l.description, l.lot_uid
    ORDER BY l.description ASC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$lots = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Si se ha pedido ver los propietarios de un lote, los cargamos
$owners_of_lot = [];
$unassigned_owners = [];
$lot_in_modal = null;
if (isset($_GET['manage_owners_for'])) {
    $lot_id_to_manage = $_GET['manage_owners_for'];
    $stmt = $pdo->prepare("SELECT id, description FROM lots WHERE id = :id");
    $stmt->execute([':id' => $lot_id_to_manage]);
    $lot_in_modal = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($lot_in_modal) {
        // Propietarios YA asignados a este lote
        $stmt = $pdo->prepare("SELECT o.id, o.name FROM owners o JOIN owner_lot_associations ola ON o.id = ola.owner_id WHERE ola.lot_id = :id ORDER BY o.name ASC");
        $stmt->execute([':id' => $lot_id_to_manage]);
        $owners_of_lot = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Propietarios AÚN NO asignados a este lote
        $stmt = $pdo->prepare("SELECT id, name FROM owners WHERE id NOT IN (SELECT owner_id FROM owner_lot_associations WHERE lot_id = :id) ORDER BY name ASC");
        $stmt->execute([':id' => $lot_id_to_manage]);
        $unassigned_owners = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>

<h1 class="page-title">Gestión de Lotes</h1>
<main class="container">
    <?php if (isset($message)): ?><div class="message success"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>
    <?php if (isset($error_message)): ?><div class="message error"><?php echo htmlspecialchars($error_message); ?></div><?php endif; ?>

    <section class="data-section">
        <table>
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th>UID de Lote</th>
                    <th>Propietarios Asignados</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($lots)): ?>
                    <tr><td colspan="4" style="text-align: center;">No hay lotes registrados.</td></tr>
                <?php else: ?>
                    <?php foreach ($lots as $lot): ?>
                        <tr data-lot-id="<?php echo $lot['id']; ?>" data-lot-description="<?php echo htmlspecialchars($lot['description']); ?>" data-lot-uid="<?php echo htmlspecialchars($lot['lot_uid'] ?? ''); ?>">
                            <td><?php echo htmlspecialchars($lot['description']); ?></td>
                            <td><?php echo htmlspecialchars($lot['lot_uid'] ?? 'N/A'); ?></td>
                            <td><span class="badge"><?php echo $lot['owner_count']; ?></span></td>
                            <td>
                                <button class="btn btn-secondary btn-sm edit-lot-btn">Editar</button>
                                <a href="index.php?page=manage_lots&manage_owners_for=<?php echo $lot['id']; ?>" class="btn btn-primary btn-sm">Ver/Asignar Propietarios</a>
                                <button class="btn btn-danger btn-sm open-delete-modal-btn">Eliminar</button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </section>
</main>

<!-- ========= MODALES ========= -->

<!-- Modal para Añadir/Editar Lote -->
<div id="lotModal" class="modal"><div class="modal-content-wrapper"><form action="index.php?page=manage_lots" method="POST"><input type="hidden" name="action" value="save_lot"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="lot_id" id="lot_id"><div class="modal-header"><h2 id="lotModalTitle">Añadir Lote</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="lot_description">Descripción:</label><input type="text" id="lot_description" name="description" class="form-control" required></div><div class="form-group"><label for="lot_uid">UID del Lote (Opcional):</label><input type="text" id="lot_uid" name="lot_uid" class="form-control"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div></form></div></div>

<!-- Modal para Gestionar Propietarios de un Lote -->
<div id="ownersModal" class="modal" <?php if ($lot_in_modal) echo 'style="display: flex;"'; ?>>
    <div class="modal-content-wrapper">
        <div class="modal-header">
            <h2 id="ownersModalTitle">Propietarios de <?php echo htmlspecialchars($lot_in_modal['description'] ?? ''); ?></h2>
            <a href="index.php?page=manage_lots" class="close-button" aria-label="Cerrar">×</a>
        </div>
        <div class="modal-body">
            <h4>Propietarios Asignados</h4>
            <div id="assignedOwnersList" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                <?php if ($lot_in_modal && !empty($owners_of_lot)): ?>
                    <table class="compact">
                        <?php foreach ($owners_of_lot as $owner): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($owner['name']); ?></td>
                                <td>
                                    <form action="index.php?page=manage_lots" method="POST" style="display:inline;">
                                        <input type="hidden" name="action" value="unassign_owner">
                                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                                        <input type="hidden" name="association_id_to_unassign" value="<?php echo $owner['id'] . '-' . $lot_in_modal['id']; ?>">
                                        <input type="hidden" name="lot_id_for_owner" value="<?php echo $lot_in_modal['id']; ?>">
                                        <button type="submit" class="btn btn-danger btn-sm">Desvincular</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                <?php else: ?>
                    <p>Este lote no tiene propietarios asignados.</p>
                <?php endif; ?>
            </div>
            <hr>
            <h4>Asignar Propietario Existente</h4>
            <form action="index.php?page=manage_lots" method="POST">
                <input type="hidden" name="action" value="assign_owner">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                <input type="hidden" name="lot_id_for_owner" value="<?php echo $lot_in_modal['id'] ?? ''; ?>">
                <div class="form-group">
                    <label for="owner_to_assign">Seleccionar Propietario:</label>
                    <select name="owner_to_assign" id="owner_to_assign" class="form-control" required>
                        <option value="">-- Elija un propietario --</option>
                        <?php foreach ($unassigned_owners as $owner): ?>
                            <option value="<?php echo $owner['id']; ?>"><?php echo htmlspecialchars($owner['name']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" <?php if(empty($unassigned_owners)) echo 'disabled'; ?>>Asignar Propietario</button>
            </form>
        </div>
        <div class="modal-footer">
            <a href="index.php?page=manage_lots" class="btn btn-secondary">Cerrar</a>
        </div>
    </div>
</div>

<!-- Modal de Confirmación de Eliminación -->
<div id="deleteLotModal" class="modal"><div class="modal-content-wrapper"><form action="index.php?page=manage_lots" method="POST"><input type="hidden" name="action" value="delete_lot"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="lot_id_to_delete" id="lotIdToDeleteInput"><div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div><div class="modal-body"><p>¿Estás seguro que deseas eliminar el lote <strong id="lotDescriptionToDelete"></strong>?<br>Se eliminarán todas sus asociaciones con propietarios.</p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar Eliminación</button></div></form></div></div>

<!-- Modal de Filtro -->
<div id="filterModal" class="modal"><div class="modal-content-wrapper"><form method="GET"><input type="hidden" name="page" value="manage_lots"><div class="modal-header"><h2>Buscar Lote</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="search_input">Buscar por Descripción o UID:</label><input type="text" name="search" id="search_input" class="form-control" value="<?php echo htmlspecialchars($search_term); ?>"></div></div><div class="modal-footer"><a href="index.php?page=manage_lots" class="btn btn-secondary">Limpiar</a><button type="submit" class="btn btn-primary">Buscar</button></div></form></div></div>

<!-- Botón de Acción Flotante (FAB) -->
<div class="fab-container"><ul class="fab-options"><li><span class="fab-label">Añadir Lote</span><button class="fab-secondary" id="openAddLotModalBtn"><i class="fas fa-plus"></i></button></li><li><span class="fab-label">Buscar / Filtrar</span><button class="fab-secondary" id="openFilterModalBtn"><i class="fas fa-search"></i></button></li></ul><button class="fab-main"><i class="fas fa-plus"></i></button></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // --- LÓGICA DEL FAB ---
    const fabMain = document.querySelector('.fab-main');
    const fabContainer = document.querySelector('.fab-container');
    if (fabMain) {
        fabMain.addEventListener('click', () => {
            fabContainer.classList.toggle('active');
        });
    }

    // --- MANEJO DE MODALES ---
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
            lotModal.style.display = 'flex';
        }
        
        if (e.target.classList.contains('open-delete-modal-btn')) {
            deleteLotModal.querySelector('#lotIdToDeleteInput').value = row.dataset.lotId;
            deleteLotModal.querySelector('#lotDescriptionToDelete').textContent = row.dataset.lotDescription;
            deleteLotModal.style.display = 'flex';
        }
    });

    // --- Cierre de Modales ---
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const closeButtons = modal.querySelectorAll('.close-button');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (button.tagName !== 'A') e.preventDefault();
                if (modal.id === 'ownersModal') {
                    window.location.href = 'index.php?page=manage_lots';
                } else {
                    modal.style.display = 'none';
                }
            });
        });
        
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                if (modal.id === 'ownersModal') {
                    window.location.href = 'index.php?page=manage_lots';
                } else {
                    modal.style.display = 'none';
                }
            }
        });
    });
});
</script>