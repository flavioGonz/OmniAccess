<?php
// manage_owners_vehicles.php (Versión 2.2 - Lógica Separada)

// PARTE 1: CONTROLADOR (LÓGICA PHP)
// Esta parte se ejecutará al principio en index.php.
// ==========================================================

// El CSRF token ya no se genera aquí, se usará el de index.php si es necesario
// o se pasará la variable.
global $pdo, $csrf_token; // Hacemos accesibles las variables globales de index.php

// --- LÓGICA DE PROCESAMIENTO POST ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validate_csrf_token($_POST['csrf_token'] ?? '')) {
        $_SESSION['error_message'] = "Error de seguridad (CSRF).";
    } else {
        $action = $_POST['action'] ?? '';

        if ($action === 'save_owner') {
            $owner_id = $_POST['owner_id'] ?? null;
            $name = trim($_POST['name'] ?? '');
            $contact = trim($_POST['contact'] ?? null);

            if (!empty($name)) {
                if (!empty($owner_id)) {
                    $stmt = $pdo->prepare("UPDATE owners SET name = :name, phone = :contact WHERE id = :id");
                    $stmt->execute([':name' => $name, ':contact' => $contact, ':id' => $owner_id]);
                    $_SESSION['success_message'] = "Propietario actualizado con éxito.";
                } else {
                    $owner_uid = 'OWNER-' . strtoupper(bin2hex(random_bytes(4)));
                    $stmt = $pdo->prepare("INSERT INTO owners (owner_uid, name, phone) VALUES (:owner_uid, :name, :contact)");
                    $stmt->execute([':owner_uid' => $owner_uid, ':name' => $name, ':contact' => $contact]);
                    $_SESSION['success_message'] = "Propietario '{$name}' añadido con éxito.";
                }
            } else {
                $_SESSION['error_message'] = "El nombre del propietario no puede estar vacío.";
            }
        } elseif ($action === 'delete_owner') {
            $owner_id_to_delete = $_POST['owner_id_to_delete'] ?? null;
            if ($owner_id_to_delete) {
                $stmt = $pdo->prepare("DELETE FROM owners WHERE id = :id");
                $stmt->execute([':id' => $owner_id_to_delete]);
                $_SESSION['success_message'] = "Propietario eliminado.";
            }
        } elseif ($action === 'assign_vehicle') {
            $owner_id = $_POST['owner_id_for_vehicle'] ?? null;
            $plate = strtoupper(trim(preg_replace('/[^A-Z0-9]/i', '', $_POST['plate'] ?? '')));
            if ($owner_id && !empty($plate)) {
                $stmt = $pdo->prepare("INSERT INTO vehicles (plate) VALUES (:plate) ON DUPLICATE KEY UPDATE plate = :plate");
                $stmt->execute([':plate' => $plate]);
                $stmt = $pdo->prepare("UPDATE vehicles SET owner_id = :owner_id WHERE plate = :plate");
                $stmt->execute([':owner_id' => $owner_id, ':plate' => $plate]);
                $_SESSION['success_message'] = "Matrícula '{$plate}' asignada correctamente.";
            } else {
                $_SESSION['error_message'] = "Faltan datos para asignar el vehículo.";
            }
        } elseif ($action === 'unassign_vehicle') {
            $vehicle_id_to_unassign = $_POST['vehicle_id_to_unassign'] ?? null;
            if ($vehicle_id_to_unassign) {
                $stmt = $pdo->prepare("UPDATE vehicles SET owner_id = NULL WHERE id = :id");
                $stmt->execute([':id' => $vehicle_id_to_unassign]);
                $_SESSION['success_message'] = "Vehículo desvinculado correctamente.";
            }
        }
    }
    
    // Redirigir siempre para evitar reenvío de formularios
    $redirect_url = 'index.php?page=manage_owners_vehicles';
    if (isset($_POST['owner_id_for_vehicle'])) {
        $redirect_url .= '&manage_vehicles_for=' . $_POST['owner_id_for_vehicle'];
    }
    header('Location: ' . $redirect_url);
    exit();
}

// --- LÓGICA GET PARA PREPARAR DATOS PARA LA VISTA ---
$message = $_SESSION['success_message'] ?? null;
$error_message = $_SESSION['error_message'] ?? null;
unset($_SESSION['success_message'], $_SESSION['error_message']);

$search_term = $_GET['search'] ?? '';
$where_sql = "";
$params = [];
if (!empty($search_term)) {
    $where_sql = "WHERE o.name LIKE :search OR o.phone LIKE :search";
    $params[':search'] = "%" . $search_term . "%";
}

$sql = "SELECT o.id, o.name, o.phone, COUNT(v.id) AS vehicle_count
        FROM owners o
        LEFT JOIN vehicles v ON o.id = v.owner_id
        $where_sql
        GROUP BY o.id, o.name, o.phone
        ORDER BY o.name ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$owners = $stmt->fetchAll(PDO::FETCH_ASSOC);

$vehicles_of_owner = [];
$owner_in_modal = null;
if (isset($_GET['manage_vehicles_for'])) {
    $owner_id_to_manage = $_GET['manage_vehicles_for'];
    $stmt = $pdo->prepare("SELECT id, name FROM owners WHERE id = :id");
    $stmt->execute([':id' => $owner_id_to_manage]);
    $owner_in_modal = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($owner_in_modal) {
        $stmt = $pdo->prepare("SELECT id, plate FROM vehicles WHERE owner_id = :id ORDER BY plate ASC");
        $stmt->execute([':id' => $owner_id_to_manage]);
        $vehicles_of_owner = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

// FIN DE LA PARTE 1
?>

<?php
// PARTE 2: VISTA (HTML)
// Esta parte solo contiene el HTML y usa las variables preparadas arriba.
// ==========================================================
?>
<h1>Gestión de Propietarios y Vehículos</h1>

<?php if (isset($message)): ?><div class="message success"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>
<?php if (isset($error_message)): ?><div class="message error"><?php echo htmlspecialchars($error_message); ?></div><?php endif; ?>

<section class="data-section">
    <table>
        <thead>
            <tr>
                <th>Nombre del Propietario</th>
                <th>Contacto (Teléfono)</th>
                <th>Vehículos Registrados</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($owners)): ?>
                <tr><td colspan="4" style="text-align: center;">No se encontraron propietarios. <?php if(!empty($search_term)) echo 'Pruebe a limpiar el filtro.' ?></td></tr>
            <?php else: ?>
                <?php foreach ($owners as $owner): ?>
                    <tr data-owner-id="<?php echo $owner['id']; ?>" data-owner-name="<?php echo htmlspecialchars($owner['name']); ?>" data-owner-contact="<?php echo htmlspecialchars($owner['phone'] ?? ''); ?>">
                        <td><?php echo htmlspecialchars($owner['name']); ?></td>
                        <td><?php echo htmlspecialchars($owner['phone'] ?? 'N/A'); ?></td>
                        <td><span class="badge"><?php echo $owner['vehicle_count']; ?></span></td>
                        <td>
                            <button class="btn btn-secondary btn-sm edit-owner-btn">Editar</button>
                            <a href="index.php?page=manage_owners_vehicles&manage_vehicles_for=<?php echo $owner['id']; ?>" class="btn btn-primary btn-sm">Ver/Asignar Vehículos</a>
                            <button class="btn btn-danger btn-sm open-delete-modal-btn">Eliminar</button>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>
</section>

<!-- ========= MODALES ========= -->
<div id="ownerModal" class="modal"><div class="modal-content-wrapper"><form action="index.php?page=manage_owners_vehicles" method="POST"><input type="hidden" name="action" value="save_owner"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="owner_id" id="owner_id"><div class="modal-header"><h2 id="ownerModalTitle">Añadir Propietario</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="owner_name">Nombre Completo:</label><input type="text" id="owner_name" name="name" class="form-control" required></div><div class="form-group"><label for="owner_contact">Contacto (Teléfono):</label><input type="text" id="owner_contact" name="contact" class="form-control"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div></form></div></div>

<div id="vehiclesModal" class="modal" <?php if ($owner_in_modal) echo 'style="display: flex;"'; ?>>
    <div class="modal-content-wrapper">
        <div class="modal-header">
            <h2 id="vehiclesModalTitle">Vehículos de <?php echo htmlspecialchars($owner_in_modal['name'] ?? ''); ?></h2>
            <a href="index.php?page=manage_owners_vehicles" class="close-button" aria-label="Cerrar">×</a>
        </div>
        <div class="modal-body">
            <h4>Vehículos Asignados</h4>
            <div id="assignedVehiclesList" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                <?php if ($owner_in_modal && !empty($vehicles_of_owner)): ?>
                    <table class="compact">
                        <?php foreach ($vehicles_of_owner as $vehicle): ?>
                            <tr>
                                <td><span class="styled-plate"><?php echo htmlspecialchars($vehicle['plate']); ?></span></td>
                                <td>
                                    <form action="index.php?page=manage_owners_vehicles" method="POST" style="display:inline;">
                                        <input type="hidden" name="action" value="unassign_vehicle">
                                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                                        <input type="hidden" name="vehicle_id_to_unassign" value="<?php echo $vehicle['id']; ?>">
                                        <input type="hidden" name="owner_id_for_vehicle" value="<?php echo $owner_in_modal['id'] ?? ''; ?>">
                                        <button type="submit" class="btn btn-danger btn-sm">Desvincular</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                <?php else: ?>
                    <p>Este propietario no tiene vehículos asignados.</p>
                <?php endif; ?>
            </div>
            <hr>
            <h4>Asignar Nuevo Vehículo</h4>
            <form id="assignVehicleForm" action="index.php?page=manage_owners_vehicles" method="POST">
                <input type="hidden" name="action" value="assign_vehicle">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                <input type="hidden" name="owner_id_for_vehicle" value="<?php echo $owner_in_modal['id'] ?? ''; ?>">
                <div class="form-group">
                    <label for="plate_to_assign">Matrícula:</label>
                    <input type="text" id="plate_to_assign" name="plate" class="form-control" required placeholder="AAA123">
                </div>
                <button type="submit" class="btn btn-primary">Asignar Matrícula</button>
            </form>
        </div>
        <div class="modal-footer">
            <a href="index.php?page=manage_owners_vehicles" class="btn btn-secondary">Cerrar</a>
        </div>
    </div>
</div>

<div id="deleteOwnerModal" class="modal"><div class="modal-content-wrapper"><form action="index.php?page=manage_owners_vehicles" method="POST"><input type="hidden" name="action" value="delete_owner"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><input type="hidden" name="owner_id_to_delete" id="ownerIdToDeleteInput"><div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div><div class="modal-body"><p>¿Estás seguro que deseas eliminar al propietario <strong id="ownerNameToDelete"></strong>?<br>Todos sus vehículos serán desvinculados.</p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar Eliminación</button></div></form></div></div>

<div id="filterModal" class="modal"><div class="modal-content-wrapper"><form method="GET"><input type="hidden" name="page" value="manage_owners_vehicles"><div class="modal-header"><h2>Buscar Propietario</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="search_input">Buscar por Nombre o Contacto:</label><input type="text" name="search" id="search_input" class="form-control" value="<?php echo htmlspecialchars($search_term); ?>"></div></div><div class="modal-footer"><a href="index.php?page=manage_owners_vehicles" class="btn btn-secondary">Limpiar</a><button type="submit" class="btn btn-primary">Buscar</button></div></form></div></div>

<div class="fab-container"><ul class="fab-options"><li><span class="fab-label">Añadir Propietario</span><button class="fab-secondary" id="openAddOwnerModalBtn"><i class="fas fa-user-plus"></i></button></li><li><span class="fab-label">Buscar / Filtrar</span><button class="fab-secondary" id="openFilterModalBtn"><i class="fas fa-search"></i></button></li></ul><button class="fab-main"><i class="fas fa-plus"></i></button></div>

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
    const ownerModal = document.getElementById('ownerModal');
    const deleteOwnerModal = document.getElementById('deleteOwnerModal');
    const filterModal = document.getElementById('filterModal');
    const vehiclesModal = document.getElementById('vehiclesModal');

    // Botones para abrir modales del FAB
    document.getElementById('openAddOwnerModalBtn').addEventListener('click', () => {
        ownerModal.querySelector('#ownerModalTitle').textContent = 'Añadir Propietario';
        ownerModal.querySelector('form').reset();
        ownerModal.querySelector('#owner_id').value = '';
        ownerModal.style.display = 'flex';
    });
    
    document.getElementById('openFilterModalBtn').addEventListener('click', () => {
        filterModal.style.display = 'flex';
    });

    // Delegación de eventos para botones en la tabla
    document.querySelector('table tbody').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;

        // Botón EDITAR PROPIETARIO
        if (e.target.classList.contains('edit-owner-btn')) {
            const ownerId = row.dataset.ownerId;
            const ownerName = row.dataset.ownerName;
            const ownerContact = row.dataset.ownerContact;

            ownerModal.querySelector('#ownerModalTitle').textContent = 'Editar Propietario';
            ownerModal.querySelector('#owner_id').value = ownerId;
            ownerModal.querySelector('#owner_name').value = ownerName;
            ownerModal.querySelector('#owner_contact').value = ownerContact;
            ownerModal.style.display = 'flex';
        }
        
        // Botón ELIMINAR PROPIETARIO
        if (e.target.classList.contains('open-delete-modal-btn')) {
            const ownerId = row.dataset.ownerId;
            const ownerName = row.dataset.ownerName;

            deleteOwnerModal.querySelector('#ownerIdToDeleteInput').value = ownerId;
            deleteOwnerModal.querySelector('#ownerNameToDelete').textContent = ownerName;
            deleteOwnerModal.style.display = 'flex';
        }
    });

    // --- Cierre de Modales ---
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const closeButtons = modal.querySelectorAll('.close-button');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Prevenir comportamiento de botón si no es un enlace
                if (button.tagName !== 'A') {
                   e.preventDefault();
                }
                // Si es el modal de vehículos, redirigir para limpiar la URL
                if (modal.id === 'vehiclesModal') {
                    window.location.href = 'index.php?page=manage_owners_vehicles';
                } else {
                    modal.style.display = 'none';
                }
            });
        });

        // Cierre al hacer clic fuera del contenido del modal
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                // Si es el modal de vehículos, redirigir para limpiar la URL
                if (modal.id === 'vehiclesModal') {
                    window.location.href = 'index.php?page=manage_owners_vehicles';
                } else {
                    modal.style.display = 'none';
                }
            }
        });
    });
});
</script>