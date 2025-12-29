<?php
// webhook.php (Versión Final)

require_once __DIR__ . '/config.php';

date_default_timezone_set('America/Argentina/Buenos_Aires');

// --- CONFIGURACIÓN ---
$error_log_file = APP_ROOT . '/hikvision_lpr.log';
$plate_images_dir = APP_ROOT . '/plate_images/';

if (!is_dir($plate_images_dir)) {
    mkdir($plate_images_dir, 0755, true); // Permisos más seguros
}

// --- CONEXIÓN A LA BASE DE DATOS ---
$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $e) {
    file_put_contents($error_log_file, date('[Y-m-d H:i:s]') . " DB_ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
    http_response_code(500);
    die("Error interno del servidor.");
}

// --- RECEPCIÓN Y PROCESAMIENTO DE DATOS ---
$xml = false;
$image_data = null;
$log_details = "";
$log_entry_prefix = date('[Y-m-d H:i:s]');

if (strpos(($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== false) {
    foreach ($_FILES as $file_key => $file_info) {
        if (isset($file_info['tmp_name']) && $file_info['error'] === UPLOAD_ERR_OK) {
            $file_content = file_get_contents($file_info['tmp_name']);
            if (strpos($file_info['type'], 'xml') !== false) {
                libxml_disable_entity_loader(true); // Prevenir XXE
                $xml = simplexml_load_string($file_content);
                libxml_disable_entity_loader(false);
            } elseif (strpos($file_info['type'], 'image/') !== false) {
                $image_data = $file_content;
            }
        }
    }
}

if ($xml === false) {
    $log_details .= "WEBHOOK_FAIL: No se pudo parsear el XML o no se recibió.\n";
    file_put_contents($error_log_file, $log_entry_prefix . $log_details, FILE_APPEND);
    http_response_code(400); // Bad Request
    die("Datos incompletos o inválidos.");
}

// --- IDENTIFICAR DISPOSITIVO (CÁMARA) POR MAC ADDRESS DEL XML ---
$mac_address = isset($xml->macAddress) ? (string)$xml->macAddress : null;
$device_id = null;
$device_name = 'Dispositivo Desconocido';

if ($mac_address) {
    $log_details .= "DEVICE_ID_FOUND_IN_XML: MAC Address = {$mac_address}\n";
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM devices WHERE mac_address = :mac_address");
        $stmt->execute([':mac_address' => $mac_address]);
        $device = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($device) {
            $device_id = $device['id'];
            $device_name = $device['name'];
            $log_details .= "DEVICE_MATCHED_IN_DB: {$device_name} (ID: {$device_id})\n";
        } else {
            $log_details .= "DEVICE_NOT_MATCHED_IN_DB: No se encontró dispositivo con MAC Address '{$mac_address}'\n";
        }
    } catch (PDOException $e) {
        $log_details .= "DB_ERROR_DEVICE_SEARCH: " . $e->getMessage() . "\n";
    }
} else {
    $log_details .= "DEVICE_ID_NOT_FOUND_IN_XML: No se encontró la etiqueta <macAddress>.\n";
}

// Extraer el resto de los datos del XML
$plate = isset($xml->ANPR->licensePlate) ? (string)$xml->ANPR->licensePlate : null;
$event_type = isset($xml->eventType) ? (string)$xml->eventType : 'desconocido';

if (!$plate) {
    $log_details .= "WEBHOOK_FAIL: No se encontró la matrícula en el XML.\n";
    file_put_contents($error_log_file, $log_entry_prefix . $log_details, FILE_APPEND);
    http_response_code(400);
    die("Matrícula no encontrada.");
}

$plate = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $plate));

// --- SAVE PLATE IMAGE ---
$image_path = null;
if (isset($image_data)) {
    $filename = $plate . '_' . date('YmdHis') . '_' . uniqid() . '.jpg';
    $image_path = 'plate_images/' . $filename;
    if (!file_put_contents(APP_ROOT . '/' . $image_path, $image_data)) {
        $log_details .= "IMAGE_SAVE_ERROR: No se pudo guardar la imagen.\n";
        $image_path = null;
    }
}

// --- PROCESAR VEHÍCULO Y SESIÓN DE PARKING ---
$stmt = $pdo->prepare("SELECT v.id, v.is_whitelisted, v.is_inside, o.name as owner_name FROM vehicles v LEFT JOIN owners o ON v.owner_id = o.id WHERE v.plate = :plate");
$stmt->execute([':plate' => $plate]);
$vehicle = $stmt->fetch(PDO::FETCH_ASSOC);

$is_new_vehicle = false;
if ($vehicle) {
    $vehicle_id = $vehicle['id'];
    $decision = $vehicle['is_whitelisted'] ? 'acceso_permitido' : 'acceso_denegado';
    $is_inside = (bool)$vehicle['is_inside'];
} else {
    $stmt = $pdo->prepare("INSERT INTO vehicles (plate, is_whitelisted, is_inside, created_at, updated_at) VALUES (:plate, 0, 0, NOW(), NOW())");
    $stmt->execute([':plate' => $plate]);
    $vehicle_id = $pdo->lastInsertId();
    $decision = 'acceso_denegado';
    $is_inside = false;
    $is_new_vehicle = true;
}

$current_timestamp = time();
$is_entry_camera = (stripos($device_name, 'entrada') !== false);
$is_exit_camera = (stripos($device_name, 'salida') !== false);

if ($is_entry_camera && !$is_inside) {
    $stmt = $pdo->prepare("INSERT INTO parking_sessions (vehicle_id, entry_time, status) VALUES (?, ?, 'in')");
    $stmt->execute([$vehicle_id, $current_timestamp]);
    $stmt = $pdo->prepare("UPDATE vehicles SET is_inside = 1, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$vehicle_id]);
    $log_details .= "VEHICLE_ENTRY: {$plate} entered.\n";
} elseif ($is_exit_camera && $is_inside) {
    $stmt = $pdo->prepare("UPDATE parking_sessions SET exit_time = ?, status = 'out' WHERE vehicle_id = ? AND status = 'in' ORDER BY entry_time DESC LIMIT 1");
    $stmt->execute([$current_timestamp, $vehicle_id]);
    $stmt = $pdo->prepare("UPDATE vehicles SET is_inside = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$vehicle_id]);
    $log_details .= "VEHICLE_EXIT: {$plate} exited.\n";
} else {
    $log_details .= "SESSION_NO_CHANGE: Device '{$device_name}' (is_entry: " . ($is_entry_camera?'true':'false') . ", is_exit: " . ($is_exit_camera?'true':'false') . ") or vehicle status 'is_inside'=" . ($is_inside?'true':'false') . " did not trigger session change.\n";
}

// --- REGISTRAR EVENTO ---
try {
    $stmt = $pdo->prepare("INSERT INTO events (vehicle_id, plate, timestamp, event_type, image_path, decision, notes, device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$vehicle_id, $plate, $current_timestamp, $event_type, $image_path, $decision, null, $device_id]);
    $log_details .= "EVENT_INSERT_SUCCESS.\n";
} catch (PDOException $e) {
    $log_details .= "DB_ERROR_EVENT_INSERT: " . $e->getMessage() . "\n";
}

file_put_contents($error_log_file, $log_entry_prefix . " " . $log_details . "---\n", FILE_APPEND);

// --- RESPUESTA A LA CÁMARA ---
header('Content-Type: application/xml');
echo '<?xml version="1.0" encoding="UTF-8"?><ResponseStatus version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema"><requestURL>/ISAPI/Event/notification/alertStream</requestURL><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>';
?>


// --- REGISTRAR EVENTOS LPR DE CAMARAS  HIKVISION ---
// --- Este es el endpoint crítico para la ingesta de eventos LPR. Su lógica es robusta:
// --- Recibe y procesa peticiones multipart/form-data.
// --- Identifica el dispositivo de origen mediante la dirección MAC extraída del XML, lo cual es un punto clave de la arquitectura.
// --- Guarda la imagen de la matrícula en el sistema de archivos.
// --- Gestiona la lógica de negocio para vehículos y sesiones de estacionamiento (entradas/salidas) en la base de datos.
// --- Registra cada transacción en un archivo de log detallado para depuración.
// --- Envía la respuesta de confirmación requerida por la cámara.