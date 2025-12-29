<?php
// dispositivos_lpr.php (Versión Final con Gestión, Lector de Whitelist y LEDs de Estado)

// Inicia la sesión para usar $_SESSION para mensajes y CSRF


require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php'; // <-- AÑADE ESTA LÍNEA

// Iniciar sesión y generar token CSRF para proteger los formularios
$csrf_token = generate_csrf_token();

$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Error de conexión a la base de datos: " . $e->getMessage());
}

/**
 * Función de utilidad para get_camera_whitelist.php.
 * Se incluye aquí para que el otro script pueda requerirla.
 * @param array $camera Detalles de la cámara ('ip', 'username', 'password').
 * @return array ['success' => bool, 'data' => array/string].
 */


$message = '';
$error_messages = [];

// --- Lógica para manejar acciones del formulario (Añadir/Editar/Eliminar) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validate_csrf_token($_POST['csrf_token'] ?? '')) {
        $error_messages[] = "Error de seguridad (CSRF). Por favor, recargue la página y vuelva a intentarlo.";
    } else {
        $action = $_POST['action'] ?? '';
        $id = $_POST['id'] ?? null;
        $name = trim($_POST['name'] ?? '');
        $ip = trim($_POST['ip'] ?? '');
        $mac_address = trim($_POST['mac_address'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($action === 'save_device') {
            if (empty($name) || empty($ip) || empty($mac_address) || empty($username)) {
                $error_messages[] = "Todos los campos (excepto la contraseña si no se cambia) son obligatorios.";
            } else {
                // Validación de formato IP/Puerto (básica)
                if (!preg_match('/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?)$/', $ip) && !filter_var($ip, FILTER_VALIDATE_URL) && !strpos($ip, ':')) {
                     // Solo validar como IP si no tiene puerto o es URL si lo tiene
                     if (!filter_var(explode(':', $ip)[0], FILTER_VALIDATE_IP)) {
                         $error_messages[] = "Formato de Dirección IP/Puerto inválido.";
                     }
                }
                // Validación MAC Address (básica)
                if (!preg_match('/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/', $mac_address)) {
                    $error_messages[] = "Formato de MAC Address inválido. Use el formato XX:XX:XX:XX:XX:XX.";
                }

                if (empty($error_messages)) { // Procede si no hay errores de validación de campos
                    if (!empty($id)) {
                        $sql = "UPDATE devices SET name = :name, ip = :ip, mac_address = :mac_address, username = :username WHERE id = :id";
                        $params = [':name' => $name, ':ip' => $ip, ':mac_address' => $mac_address, ':username' => $username, ':id' => $id];
                        if (!empty($password)) {
                            $sql = "UPDATE devices SET name = :name, ip = :ip, mac_address = :mac_address, username = :username, password = :password WHERE id = :id";
                            $params[':password'] = $password;
                        }
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $message = "Dispositivo '{$name}' actualizado con éxito.";
                    } else {
                        if (empty($password)) $error_messages[] = "La contraseña es obligatoria para nuevos dispositivos.";
                        else {
                            try {
                                $stmt = $pdo->prepare("INSERT INTO devices (name, ip, mac_address, username, password, created_at) VALUES (:name, :ip, :mac_address, :username, :password, NOW())");
                                $stmt->execute([':name' => $name, ':ip' => $ip, ':mac_address' => $mac_address, ':username' => $username, ':password' => $password]);
                                $message = "Dispositivo '{$name}' añadido con éxito.";
                            } catch (PDOException $e) {
                                if ($e->getCode() === '23000') $error_messages[] = "Error: El nombre o la MAC Address ya existen (violación de clave única).";
                                else $error_messages[] = "Error al añadir dispositivo: " . $e->getMessage();
                            }
                        }
                    }
                }
            }
        } elseif ($action === 'delete_device') {
            if (!empty($id)) {
                try {
                    $stmt = $pdo->prepare("DELETE FROM devices WHERE id = :id");
                    $stmt->execute([':id' => $id]);
                    $message = "Dispositivo eliminado con éxito.";
                } catch (PDOException $e) {
                    $error_messages[] = "Error al eliminar dispositivo: " . $e->getMessage() . " (Posiblemente tenga eventos asociados. Elimínelos primero si desea borrar el dispositivo.)";
                }
            } else { $error_messages[] = "ID de dispositivo no especificado para eliminar."; }
        }
    }
    $_SESSION['success_message'] = $message;
    $_SESSION['error_messages'] = $error_messages;
    header("Location: index.php?page=dispositivos_lpr");
    exit();
}

if (isset($_SESSION['success_message'])) { $message = $_SESSION['success_message']; unset($_SESSION['success_message']); }
if (isset($_SESSION['error_messages'])) { $error_messages = $_SESSION['error_messages']; unset($_SESSION['error_messages']); }

$devices = $pdo->query("SELECT id, name, ip, mac_address, username, password, created_at FROM devices ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>


<h1>Gestión de Dispositivos LPR</h1>


<main class="container">
    <?php if (!empty($message)): ?><div class="message success"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>
    <?php if (!empty($error_messages)): ?><div class="message error"><ul><?php foreach ($error_messages as $error): ?><li><?php echo htmlspecialchars($error); ?></li><?php endforeach; ?></ul></div><?php endif; ?>

    <button class="btn btn-primary" id="open-add-modal-btn">Añadir Nuevo Dispositivo</button>

    <section class="data-section" style="margin-top: 2rem;">
        <h2>Dispositivos Configurados</h2>
        <?php if (!empty($devices)): ?>
            <table>
                <thead>
                    <tr>
                        <th>Estado</th>
                        <th>Nombre (Entrada/Salida)</th>
                        <th>Dirección IP:Puerto</th>
                        <th>MAC Address</th>
                        <th>Usuario</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($devices as $device): ?>
                        <tr data-device-id="<?php echo $device['id']; ?>">
                            <td><span class="status-led pending" id="status-led-<?php echo $device['id']; ?>" title="Comprobando estado..."></span></td>
                            <td><?php echo htmlspecialchars($device['name']); ?></td>
                            <td><?php echo htmlspecialchars($device['ip']); ?></td>
                            <td><?php echo htmlspecialchars($device['mac_address']); ?></td>
                            <td><?php echo htmlspecialchars($device['username']); ?></td>
                            <td>
                                <button class="btn btn-secondary view-whitelist-btn" data-id="<?php echo $device['id']; ?>" data-name="<?php echo htmlspecialchars($device['name']); ?>">Ver Lista</button>
                                <button class="btn btn-secondary edit-btn" 
                                    data-id="<?php echo $device['id']; ?>" 
                                    data-name="<?php echo htmlspecialchars($device['name']); ?>" 
                                    data-ip="<?php echo htmlspecialchars($device['ip']); ?>" 
                                    data-mac_address="<?php echo htmlspecialchars($device['mac_address']); ?>" 
                                    data-username="<?php echo htmlspecialchars($device['username']); ?>"
                                    data-password-exists="<?php echo !empty($device['password']) ? 'true' : 'false'; ?>"
                                >Editar</button>
                                <button type="button" class="btn btn-danger delete-btn" data-id="<?php echo $device['id']; ?>" data-name="<?php echo htmlspecialchars($device['name']); ?>">Eliminar</button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="message info">No hay dispositivos registrados.</p>
        <?php endif; ?>
    </section>

    <div id="device-modal" class="modal" style="display: none;">
        <div class="modal-content-wrapper">
            <form id="device-form" action="index.php?page=dispositivos_lpr" method="POST">
                <input type="hidden" name="action" value="save_device">
                <input type="hidden" name="id" id="device-id">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                <div class="modal-header">
                    <h2 id="modal-title">Añadir Dispositivo</h2>
                    <span class="close-button">×</span>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label for="device-name">Nombre (ej. "Cámara Entrada"):</label><input type="text" id="device-name" name="name" required></div>
                    <div class="form-group"><label for="device-ip">Dirección IP:Puerto (ej. `dominio.com:8881`):</label><input type="text" id="device-ip" name="ip" required></div>
                    <div class="form-group"><label for="device-mac">MAC Address (ej. `AA:BB:CC:DD:EE:FF`):</label><input type="text" id="device-mac" name="mac_address" required placeholder="Ej: AA:BB:CC:DD:EE:FF"></div>
                    <div class="form-group"><label for="device-username">Usuario:</label><input type="text" id="device-username" name="username" required></div>
                    <div class="form-group"><label for="device-password">Contraseña (dejar en blanco para no cambiar):</label><input type="password" id="device-password" name="password"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-button-device-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar Dispositivo</button>
                </div>
            </form>
        </div>
    </div>
    
    <div id="view-whitelist-modal" class="modal" style="display: none;">
        <div class="modal-content-wrapper">
            <div class="modal-header">
                <h2 id="whitelist-modal-title">Lista Blanca de Cámara</h2>
                <span class="close-button">×</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <input type="text" id="modal-search-input" class="form-control" placeholder="Buscar matrícula o propietario..." style="width: 100%; box-sizing: border-box;">
                </div>
                <div id="whitelist-content">
                    <div class="spinner"></div>
                    <p>Cargando datos de la cámara...</p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-button-whitelist-modal">Cerrar</button>
            </div>
        </div>
    </div>

    <div id="delete-confirm-modal" class="modal" style="display: none;">
        <div class="modal-content-wrapper small-modal-content">
            <div class="modal-header">
                <h2>Confirmar Eliminación</h2>
                <span class="close-button">×</span>
            </div>
            <div class="modal-body">
                <p>¿Estás seguro de que quieres eliminar el dispositivo "<strong id="delete-device-name"></strong>"?</p>
                <p class="message warning">¡Advertencia! Esto eliminará el dispositivo de la base de datos. Si hay eventos asociados a este dispositivo, la eliminación podría fallar debido a restricciones de integridad referencial.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-button-delete-modal">Cancelar</button>
                <form action="index.php?page=dispositivos_lpr" method="POST" style="display:inline-block;">
                    <input type="hidden" name="action" value="delete_device">
                    <input type="hidden" name="id" id="delete-device-id">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                    <button type="submit" class="btn btn-danger">Sí, Eliminar</button>
                </form>
            </div>
        </div>
    </div>

</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a los modales principales
    const deviceModal = document.getElementById('device-modal');
    const viewWhitelistModal = document.getElementById('view-whitelist-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal'); // Nuevo modal de eliminación

    // --- LÓGICA MODAL AÑADIR/EDITAR DISPOSITIVO ---
    const openAddModalBtn = document.getElementById('open-add-modal-btn');
    const editButtons = document.querySelectorAll('.edit-btn');
    const deviceForm = document.getElementById('device-form');
    const modalTitle = document.getElementById('modal-title');
    const deviceIdInput = document.getElementById('device-id');
    const deviceNameInput = document.getElementById('device-name');
    const deviceIpInput = document.getElementById('device-ip');
    const deviceMacInput = document.getElementById('device-mac');
    const deviceUsernameInput = document.getElementById('device-username');
    const devicePasswordInput = document.getElementById('device-password');
    
    // Botones de cierre específicos para el modal de dispositivo
    const closeDeviceModalButtons = deviceModal.querySelectorAll('.close-button, .close-button-device-modal');

    // Función para resetear el formulario del modal
    function resetDeviceForm() {
        deviceForm.reset(); // Restablece todos los campos del formulario
        deviceIdInput.value = '';
        modalTitle.textContent = 'Añadir Dispositivo';
        devicePasswordInput.placeholder = ''; // No placeholder para añadir
        devicePasswordInput.required = true; // La contraseña es requerida para añadir
    }

    // Abrir modal para añadir
    openAddModalBtn.addEventListener('click', function() {
        resetDeviceForm();
        deviceModal.style.display = 'flex';
    });

    // Abrir modal para editar
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            resetDeviceForm(); // Limpia antes de rellenar
            modalTitle.textContent = 'Editar Dispositivo';
            deviceIdInput.value = this.dataset.id;
            deviceNameInput.value = this.dataset.name;
            deviceIpInput.value = this.dataset.ip;
            deviceMacInput.value = this.dataset.mac_address;
            deviceUsernameInput.value = this.dataset.username;
            devicePasswordInput.required = false; // La contraseña no es requerida al editar
            devicePasswordInput.placeholder = 'Dejar en blanco para no cambiar';
            deviceModal.style.display = 'flex';
        });
    });

    // Cerrar modal de dispositivo
    closeDeviceModalButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            deviceModal.style.display = 'none';
        });
    });

    // --- LÓGICA MODAL PARA VER LISTA BLANCA (MEJORADO) ---
    const viewWhitelistButtons = document.querySelectorAll('.view-whitelist-btn');
    const whitelistModalTitle = document.getElementById('whitelist-modal-title');
    const whitelistContentDiv = document.getElementById('whitelist-content');
    const modalSearchInput = document.getElementById('modal-search-input');
    const closeViewWhitelistButtons = viewWhitelistModal.querySelectorAll('.close-button, .close-button-whitelist-modal'); // Mismo cambio aquí

    let fullWhitelistData = []; // Variable para almacenar los datos completos sin filtrar

    function renderWhitelist(dataToRender) {
        let html = `<h4>Total: ${dataToRender.length} de ${fullWhitelistData.length} matrículas mostradas</h4>`;
        if (dataToRender.length > 0) {
            html += '<table style="width: 100%; text-align: left;"><thead><tr><th style="width: 40%;">Matrícula</th><th>Propietario (en BD Local)</th></tr></thead><tbody>';
            dataToRender.forEach(plateInfo => {
                const ownerClass = plateInfo.owner_name === 'No Registrado' ? 'style="color: var(--secondary-text-color); font-style: italic;"' : '';
                html += `<tr>
                            <td><span class="styled-plate">${plateInfo.plate_number}</span></td>
                            <td ${ownerClass}>${plateInfo.owner_name}</td>
                           </tr>`;
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="message info">No se encontraron coincidencias.</p>';
        }
        whitelistContentDiv.innerHTML = `<div style="max-height: 50vh; overflow-y: auto;">${html}</div>`;
    }

    modalSearchInput.addEventListener('keyup', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredData = fullWhitelistData.filter(item => {
            return item.plate_number.toLowerCase().includes(searchTerm) || 
                   item.owner_name.toLowerCase().includes(searchTerm);
        });
        renderWhitelist(filteredData);
    });

    viewWhitelistButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const deviceId = this.dataset.id;
            const deviceName = this.dataset.name;
            fullWhitelistData = []; // Limpiar datos anteriores
            modalSearchInput.value = ''; // Limpiar búsqueda anterior

            whitelistModalTitle.textContent = `Auditoría de Lista Blanca: ${deviceName}`;
            whitelistContentDiv.innerHTML = '<div class="spinner"></div><p>Contactando a la cámara y cruzando datos...</p>';
            viewWhitelistModal.style.display = 'flex';

            try {
                const response = await fetch(`get_camera_whitelist.php?id=${deviceId}`);
                const result = await response.json();
                
                if (result.success) {
                    fullWhitelistData = result.data;
                    renderWhitelist(fullWhitelistData);
                } else {
                    whitelistContentDiv.innerHTML = `<p class="message error">Error: ${result.message}</p>`;
                }
            } catch (error) {
                whitelistContentDiv.innerHTML = `<p class="message error">Error de conexión al intentar obtener los datos.</p>`;
            }
        });
    });

    closeViewWhitelistButtons.forEach(button => {
        button.addEventListener('click', () => {
            viewWhitelistModal.style.display = 'none';
        });
    });

    // --- LÓGICA MODAL PARA CONFIRMACIÓN DE ELIMINACIÓN ---
    const deleteButtons = document.querySelectorAll('.delete-btn');
    const deleteDeviceNameSpan = document.getElementById('delete-device-name');
    const deleteDeviceIdInput = document.getElementById('delete-device-id');
    const closeDeleteModalButtons = deleteConfirmModal.querySelectorAll('.close-button, .close-button-delete-modal');

    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const deviceId = this.dataset.id;
            const deviceName = this.dataset.name;

            deleteDeviceNameSpan.textContent = deviceName;
            deleteDeviceIdInput.value = deviceId;
            deleteConfirmModal.style.display = 'flex';
        });
    });

    closeDeleteModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            deleteConfirmModal.style.display = 'none';
        });
    });

    // --- CERRAR MODALES AL HACER CLIC FUERA ---
    window.addEventListener('click', event => {
        if (event.target == deviceModal) deviceModal.style.display = 'none';
        if (event.target == viewWhitelistModal) viewWhitelistModal.style.display = 'none';
        if (event.target == deleteConfirmModal) deleteConfirmModal.style.display = 'none';
    });

    // --- LÓGICA PARA COMPROBAR ESTADO DE CÁMARAS (LED) ---
    async function checkAllDevicesStatus() {
        try {
            const response = await fetch('check_devices_status.php');
            if (!response.ok) { console.error('Error al llamar a la API de chequeo de estado.'); return; }
            const statuses = await response.json();
            statuses.forEach(deviceStatus => {
                const ledElement = document.getElementById(`status-led-${deviceStatus.id}`);
                if (ledElement) {
                    ledElement.classList.remove('pending', 'online', 'offline'); // Limpiar clases anteriores
                    ledElement.classList.add(deviceStatus.status);
                    ledElement.title = deviceStatus.message;
                }
            });
        } catch (error) { console.error('Error de red al comprobar estado de dispositivos:', error); }
    }
    checkAllDevicesStatus();
    setInterval(checkAllDevicesStatus, 60000); // Refrescar estado cada 60 segundos
});
</script>