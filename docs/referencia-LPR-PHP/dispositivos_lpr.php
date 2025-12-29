<?php
// dispositivos_lpr.php (Versión Final con Sincronización Forzada)

global $pdo, $csrf_token;
require_once __DIR__ . '/api_helpers.php';

$message = $_SESSION['success_message'] ?? '';
$error_messages = $_SESSION['error_messages'] ?? [];
unset($_SESSION['success_message'], $_SESSION['error_messages']);

// --- Lógica para manejar acciones del formulario (Añadir/Editar/Eliminar) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && validate_csrf_token($_POST['csrf_token'] ?? '')) {
    $action = $_POST['action'] ?? '';
    $id = $_POST['id'] ?? null;
    $name = trim($_POST['name'] ?? '');
    $purpose = trim($_POST['purpose'] ?? 'undefined');
    $ip = trim($_POST['ip'] ?? '');
    $mac_address = trim($_POST['mac_address'] ?? '');
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $current_error_messages = [];

    if ($action === 'save_device') {
        if (empty($name) || empty($ip) || empty($mac_address) || empty($username)) {
            $current_error_messages[] = "Todos los campos (excepto la contraseña si no se cambia) son obligatorios.";
        } else {
            if (!preg_match('/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/', $mac_address)) { $current_error_messages[] = "Formato de MAC Address inválido."; }
            
            if (empty($current_error_messages)) {
                if (!empty($id)) {
                    $sql = "UPDATE devices SET name = :name, purpose = :purpose, ip = :ip, mac_address = :mac_address, username = :username" . (!empty($password) ? ", password = :password" : "") . " WHERE id = :id";
                    $params = [':name' => $name, ':purpose' => $purpose, ':ip' => $ip, ':mac_address' => $mac_address, ':username' => $username, ':id' => $id];
                    if (!empty($password)) $params[':password'] = $password;
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $_SESSION['success_message'] = "Dispositivo '{$name}' actualizado con éxito.";
                } else {
                    if (empty($password)) $current_error_messages[] = "La contraseña es obligatoria para nuevos dispositivos.";
                    else {
                        try {
                            $stmt = $pdo->prepare("INSERT INTO devices (name, purpose, ip, mac_address, username, password, created_at) VALUES (:name, :purpose, :ip, :mac_address, :username, :password, NOW())");
                            $stmt->execute([':name' => $name, ':purpose' => $purpose, ':ip' => $ip, ':mac_address' => $mac_address, ':username' => $username, ':password' => $password]);
                            $_SESSION['success_message'] = "Dispositivo '{$name}' añadido con éxito.";
                        } catch (PDOException $e) {
                            if ($e->getCode() === '23000') $current_error_messages[] = "Error: El nombre o la MAC Address ya existen.";
                            else $current_error_messages[] = "Error al añadir dispositivo: " . $e->getMessage();
                        }
                    }
                }
            }
        }
        $_SESSION['error_messages'] = $current_error_messages;
    } elseif ($action === 'delete_device') {
        if (!empty($_POST['id'])) {
            try {
                $stmt = $pdo->prepare("DELETE FROM devices WHERE id = :id");
                $stmt->execute([':id' => $_POST['id']]);
                $_SESSION['success_message'] = "Dispositivo eliminado con éxito.";
            } catch (PDOException $e) { $_SESSION['error_messages'] = ["Error al eliminar dispositivo: " . $e->getMessage()]; }
        } else { $_SESSION['error_messages'] = ["ID de dispositivo no especificado para eliminar."]; }
    }
    header("Location: index.php?page=dispositivos_lpr");
    exit();
}

$devices = $pdo->query("SELECT id, name, purpose, ip, mac_address, username, password, created_at FROM devices ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<!-- PARTE 2: VISTA (HTML) -->
<h1>Gestión de Dispositivos LPR</h1>

<main class="container">
    <?php if (!empty($message)): ?><div class="message success"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>
    <?php if (!empty($error_messages)): ?><div class="message error"><ul><?php foreach ($error_messages as $error): ?><li><?php echo htmlspecialchars($error); ?></li><?php endforeach; ?></ul></div><?php endif; ?>

    <button class="btn btn-primary" id="open-add-modal-btn"><i class="fas fa-plus"></i> Añadir Nuevo Dispositivo</button>

    <section class="data-section" style="margin-top: 2rem;">
        <h2>Dispositivos Configurados</h2>
        <?php if (!empty($devices)): ?>
            <table>
                <thead>
                    <tr><th>Estado</th><th>Nombre</th><th>Propósito</th><th>IP:Puerto</th><th>MAC Address</th><th>Usuario</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                    <?php foreach ($devices as $device): ?>
                        <tr data-device-id="<?php echo $device['id']; ?>">
                            <td><span class="status-led pending" id="status-led-<?= $device['id'] ?>" title="Comprobando..."></span></td>
                            <td><?= htmlspecialchars($device['name']) ?></td>
                            <td>
                                <?php
                                $purpose_text = 'Indefinido'; $purpose_class = 'text-gray';
                                if ($device['purpose'] === 'entry') { $purpose_text = 'Entrada'; $purpose_class = 'decision-green-text'; } 
                                elseif ($device['purpose'] === 'exit') { $purpose_text = 'Salida'; $purpose_class = 'decision-red-text'; }
                                echo "<span class='{$purpose_class}'><strong>{$purpose_text}</strong></span>";
                                ?>
                            </td>
                            <td><?= htmlspecialchars($device['ip']) ?></td>
                            <td><?= htmlspecialchars($device['mac_address']) ?></td>
                            <td><?= htmlspecialchars($device['username']) ?></td>
                            <td>
                                <button class="btn btn-secondary btn-sm view-whitelist-btn" data-id="<?= $device['id'] ?>" data-name="<?= htmlspecialchars($device['name']) ?>">Ver Lista</button>
                                <button class="btn btn-secondary btn-sm edit-btn" data-id="<?= $device['id'] ?>" data-name="<?= htmlspecialchars($device['name']) ?>" data-purpose="<?= htmlspecialchars($device['purpose']) ?>" data-ip="<?= htmlspecialchars($device['ip']) ?>" data-mac_address="<?= htmlspecialchars($device['mac_address']) ?>" data-username="<?= htmlspecialchars($device['username']) ?>">Editar</button>
                                <button type="button" class="btn btn-danger btn-sm delete-btn" data-id="<?= $device['id'] ?>" data-name="<?= htmlspecialchars($device['name']) ?>">Eliminar</button>
                                <button class="btn btn-primary btn-sm open-force-sync-modal-btn" data-id="<?= $device['id'] ?>" data-name="<?= htmlspecialchars($device['name']) ?>" style="background-color: var(--primary-yellow); margin-left: 5px;">
                                    <i class="fas fa-sync-alt"></i> Forzar Sincro
                                </button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="message info">No hay dispositivos registrados.</p>
        <?php endif; ?>
    </section>

    <div id="device-modal" class="modal"><div class="modal-content-wrapper"><form id="device-form" action="index.php?page=dispositivos_lpr" method="POST"><input type="hidden" name="action" value="save_device"><input type="hidden" name="id" id="device-id"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><div class="modal-header"><h2 id="modal-title">Añadir Dispositivo</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><label for="device-name">Nombre (ej. "Cámara Entrada"):</label><input type="text" id="device-name" name="name" class="form-control" required></div><div class="form-group"><label for="device-purpose">Propósito del Dispositivo:</label><select id="device-purpose" name="purpose" class="form-control"><option value="entry">Entrada</option><option value="exit">Salida</option><option value="undefined">Indefinido / Otro</option></select></div><div class="form-group"><label for="device-ip">Dirección IP:Puerto (ej. `dominio.com:8881`):</label><input type="text" id="device-ip" name="ip" class="form-control" required></div><div class="form-group"><label for="device-mac">MAC Address (ej. `AA:BB:CC:DD:EE:FF`):</label><input type="text" id="device-mac" name="mac_address" class="form-control" required></div><div class="form-group"><label for="device-username">Usuario:</label><input type="text" id="device-username" name="username" class="form-control" required></div><div class="form-group"><label for="device-password">Contraseña (dejar en blanco para no cambiar):</label><input type="password" id="device-password" name="password" class="form-control"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="submit" class="btn btn-primary">Guardar Dispositivo</button></div></form></div></div>
    <div id="view-whitelist-modal" class="modal"><div class="modal-content-wrapper"><div class="modal-header"><h2 id="whitelist-modal-title">Lista Blanca de Cámara</h2><span class="close-button">×</span></div><div class="modal-body"><div class="form-group"><input type="text" id="modal-search-input" class="form-control" placeholder="Buscar matrícula o propietario..." style="width: 100%; box-sizing: border-box;"></div><div id="whitelist-content"><div class="spinner"></div><p>Cargando datos de la cámara...</p></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cerrar</button></div></div></div>
    <div id="delete-confirm-modal" class="modal"><div class="modal-content-wrapper small-modal-content"><div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div><div class="modal-body"><p>¿Estás seguro de que quieres eliminar el dispositivo "<strong id="delete-device-name"></strong>"?</p><p class="message warning">¡Advertencia! Esta acción es irreversible.</p></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><form action="index.php?page=dispositivos_lpr" method="POST" style="display:inline-block;"><input type="hidden" name="action" value="delete_device"><input type="hidden" name="id" id="delete-device-id"><input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>"><button type="submit" class="btn btn-danger">Sí, Eliminar</button></form></div></div></div>
    
    <div id="force-sync-modal" class="modal"><div class="modal-content-wrapper small-modal-content"><div class="modal-header"><h2><i class="fas fa-exclamation-triangle" style="color: #f1c40f;"></i> Confirmar Sincronización</h2><span class="close-button">×</span></div><div class="modal-body"><p>Está a punto de sincronizar la cámara "<strong id="sync-device-name"></strong>" con la base de datos.</p><p class="message warning"><strong>¡ADVERTENCIA!</strong> Esta acción <strong>borrará toda la lista blanca actual de la cámara</strong> y la reemplazará con las matrículas de su base de datos. Esta acción es irreversible.</p><div id="sync-status-area" style="display: none;"><div class="spinner"></div><p id="sync-status-message">Sincronizando...</p></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cancelar</button><button type="button" id="confirm-force-sync-btn" class="btn btn-primary" style="background-color: var(--primary-yellow);">Sí, Sincronizar Ahora</button></div></div></div>
</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const deviceModal = document.getElementById('device-modal');
    const viewWhitelistModal = document.getElementById('view-whitelist-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const forceSyncModal = document.getElementById('force-sync-modal');
    
    // --- LÓGICA MODAL AÑADIR/EDITAR DISPOSITIVO ---
    const openAddModalBtn = document.getElementById('open-add-modal-btn');
    if(openAddModalBtn) {
        openAddModalBtn.addEventListener('click', function() {
            const form = document.getElementById('device-form');
            form.reset();
            document.getElementById('device-id').value = '';
            document.getElementById('modal-title').textContent = 'Añadir Dispositivo';
            document.getElementById('device-password').required = true;
            document.getElementById('device-password').placeholder = '';
            deviceModal.style.display = 'flex';
        });
    }
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('device-form').reset();
            document.getElementById('modal-title').textContent = 'Editar Dispositivo';
            document.getElementById('device-id').value = this.dataset.id;
            document.getElementById('device-name').value = this.dataset.name;
            document.getElementById('device-purpose').value = this.dataset.purpose;
            document.getElementById('device-ip').value = this.dataset.ip;
            document.getElementById('device-mac').value = this.dataset.mac_address;
            document.getElementById('device-username').value = this.dataset.username;
            const passwordInput = document.getElementById('device-password');
            passwordInput.required = false;
            passwordInput.placeholder = 'Dejar en blanco para no cambiar';
            deviceModal.style.display = 'flex';
        });
    });

    // --- LÓGICA MODAL VER LISTA BLANCA ---
    let fullWhitelistData = [];
    document.querySelectorAll('.view-whitelist-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const deviceId = this.dataset.id;
            const deviceName = this.dataset.name;
            fullWhitelistData = [];
            document.getElementById('modal-search-input').value = '';
            document.getElementById('whitelist-modal-title').textContent = `Auditoría de Lista Blanca: ${deviceName}`;
            const contentDiv = document.getElementById('whitelist-content');
            contentDiv.innerHTML = '<div class="spinner"></div><p>Contactando a la cámara...</p>';
            viewWhitelistModal.style.display = 'flex';
            try {
                const response = await fetch(`get_camera_whitelist.php?id=${deviceId}`);
                const result = await response.json();
                if (result.success) { fullWhitelistData = result.data; renderWhitelist(fullWhitelistData); } 
                else { contentDiv.innerHTML = `<p class="message error">Error: ${result.message}</p>`; }
            } catch (error) { contentDiv.innerHTML = `<p class="message error">Error de conexión.</p>`; }
        });
    });
    function renderWhitelist(dataToRender) {
        const contentDiv = document.getElementById('whitelist-content');
        let html = `<h4>Total: ${dataToRender.length} de ${fullWhitelistData.length} matrículas mostradas</h4>`;
        if (dataToRender.length > 0) {
            html += '<table style="width: 100%;"><thead><tr><th>Matrícula</th><th>Propietario (BD Local)</th></tr></thead><tbody>';
            dataToRender.forEach(plateInfo => {
                const ownerClass = plateInfo.owner_name === 'No Registrado' ? 'style="color: var(--secondary-text-color); font-style: italic;"' : '';
                html += `<tr><td><span class="styled-plate">${plateInfo.plate_number}</span></td><td ${ownerClass}>${plateInfo.owner_name}</td></tr>`;
            });
            html += '</tbody></table>';
        } else { html += '<p class="message info">No se encontraron coincidencias.</p>'; }
        contentDiv.innerHTML = `<div style="max-height: 50vh; overflow-y: auto;">${html}</div>`;
    }
    document.getElementById('modal-search-input').addEventListener('keyup', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredData = fullWhitelistData.filter(item => item.plate_number.toLowerCase().includes(searchTerm) || item.owner_name.toLowerCase().includes(searchTerm));
        renderWhitelist(filteredData);
    });

    // --- LÓGICA MODAL BORRAR DISPOSITIVO ---
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('delete-device-name').textContent = this.dataset.name;
            document.getElementById('delete-device-id').value = this.dataset.id;
            deleteConfirmModal.style.display = 'flex';
        });
    });

    // --- LÓGICA MODAL SINCRONIZACIÓN FORZADA ---
    if(forceSyncModal) {
        let cameraIdToSync = null;
        document.querySelectorAll('.open-force-sync-modal-btn').forEach(button => {
            button.addEventListener('click', function() {
                cameraIdToSync = this.dataset.id;
                document.getElementById('sync-device-name').textContent = this.dataset.name;
                document.getElementById('sync-status-area').style.display = 'none';
                const confirmBtn = document.getElementById('confirm-force-sync-btn');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Sí, Sincronizar Ahora';
                forceSyncModal.style.display = 'flex';
            });
        });
        document.getElementById('confirm-force-sync-btn').addEventListener('click', async function() {
            this.disabled = true;
            const statusArea = document.getElementById('sync-status-area');
            const statusMessage = document.getElementById('sync-status-message');
            statusArea.style.display = 'block';
            statusMessage.textContent = 'Iniciando...';
            try {
                const response = await fetch('force_sync_whitelist.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ camera_id: cameraIdToSync })
                });
                const result = await response.json();
                if (!response.ok || !result.success) { throw new Error(result.message || 'Error desconocido.'); }
                statusMessage.innerHTML = `¡Completado!<br><small>${result.message}</small>`;
            } catch (error) {
                statusMessage.innerHTML = `<span style="color: var(--decision-red);">Error: ${error.message}</span>`;
            } finally {
                this.innerHTML = 'Finalizado';
            }
        });
    }
    
    // --- LÓGICA GENERAL DE CIERRE DE MODALES ---
    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', () => modal.style.display = 'none'));
        modal.addEventListener('click', event => { if (event.target === modal) modal.style.display = 'none'; });
    });

    // --- LÓGICA PARA COMPROBAR ESTADO DE CÁMARAS (LED) ---
    async function checkAllDevicesStatus() {
        try {
            const response = await fetch('check_devices_status.php');
            if (!response.ok) return;
            const statuses = await response.json();
            statuses.forEach(deviceStatus => {
                const ledElement = document.getElementById(`status-led-${deviceStatus.id}`);
                if (ledElement) {
                    ledElement.className = 'status-led ' + deviceStatus.status;
                    ledElement.title = deviceStatus.message;
                }
            });
        } catch (error) {}
    }
    checkAllDevicesStatus();
    setInterval(checkAllDevicesStatus, 60000);
});
</script>