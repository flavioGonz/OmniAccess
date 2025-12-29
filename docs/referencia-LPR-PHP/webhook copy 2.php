<?php
// webhook.php (Versión Final - con Timestamp de Cámara)

require_once __DIR__ . '/config.php';

// Asegura la zona horaria para funciones de fecha/hora de PHP (como time() y date())
date_default_timezone_set('America/Argentina/Buenos_Aires');

// --- CONFIGURACIÓN ---
$error_log_file = APP_ROOT . '/hikvision_lpr.log';
$plate_images_dir = APP_ROOT . '/plate_images/';

if (!is_dir($plate_images_dir)) {
    // Intenta crear el directorio de imágenes con permisos seguros
    if (!mkdir($plate_images_dir, 0755, true)) {
        file_put_contents($error_log_file, date('[Y-m-d H:i:s]') . " FATAL_ERROR: No se pudo crear el directorio de imágenes: {$plate_images_dir}\n", FILE_APPEND);
        http_response_code(500);
        die("Error interno del servidor: No se pudo inicializar el almacenamiento de imágenes.");
    }
}

// --- CONEXIÓN A LA BASE DE DATOS ---
$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false); // Desactiva la emulación para preparar sentencias de forma nativa
} catch (PDOException $e) {
    file_put_contents($error_log_file, date('[Y-m-d H:i:s]') . " DB_ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
    http_response_code(500);
    die("Error interno del servidor: Fallo en la conexión a la base de datos.");
}

// --- RECEPCIÓN Y PROCESAMIENTO DE DATOS ---
$xml = false;
$image_data = null;
$log_details = "";
$log_entry_prefix = date('[Y-m-d H:i:s]'); // Prefijo de log con la hora del servidor

// Verifica si la petición es multipart/form-data
if (strpos(($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== false) {
    // Itera sobre los archivos subidos para encontrar el XML y la imagen
    foreach ($_FILES as $file_key => $file_info) {
        if (isset($file_info['tmp_name']) && $file_info['error'] === UPLOAD_ERR_OK) {
            $file_content = file_get_contents($file_info['tmp_name']);
            if (strpos($file_info['type'], 'xml') !== false) {
                libxml_disable_entity_loader(true); // Medida de seguridad: previene ataques XXE
                $xml = simplexml_load_string($file_content);
                libxml_disable_entity_loader(false);
            } elseif (strpos($file_info['type'], 'image/') !== false) {
                $image_data = $file_content;
            }
        }
    }
}

// Si el XML no se pudo parsear o no se recibió, registra el error y termina
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

// Extraer la matrícula y el tipo de evento del XML
$plate = isset($xml->ANPR->licensePlate) ? (string)$xml->ANPR->licensePlate : null;
$event_type = isset($xml->eventType) ? (string)$xml->eventType : 'desconocido';

// Si no se encuentra la matrícula, registra el error y termina
if (!$plate) {
    $log_details .= "WEBHOOK_FAIL: No se encontró la matrícula en el XML.\n";
    file_put_contents($error_log_file, $log_entry_prefix . $log_details, FILE_APPEND);
    http_response_code(400);
    die("Matrícula no encontrada.");
}

// Limpia y formatea la matrícula (ej. elimina caracteres no alfanuméricos, convierte a mayúsculas)
$plate = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $plate));

// --- OBTENER TIMESTAMP DE LA CÁMARA O FALLBACK AL DEL SERVIDOR ---
$event_timestamp_from_camera = null;
if (isset($xml->dateTime)) {
    $camera_datetime_string = (string)$xml->dateTime;
    // strtotime() es flexible y puede parsear formatos ISO 8601 (ej. 2025-08-02T15:01:42-03:00)
    $parsed_timestamp = strtotime($camera_datetime_string);
    if ($parsed_timestamp !== false) {
        $event_timestamp_from_camera = $parsed_timestamp;
        $log_details .= "TIMESTAMP_FROM_CAMERA: {$camera_datetime_string} ({$event_timestamp_from_camera})\n";
    } else {
        $log_details .= "TIMESTAMP_PARSE_ERROR: No se pudo parsear el timestamp '{$camera_datetime_string}' del XML. Usando hora del servidor.\n";
    }
} else {
    $log_details .= "TIMESTAMP_MISSING_XML: Etiqueta <dateTime> no encontrada en el XML. Usando hora del servidor.\n";
}

// Establece el timestamp del evento: prioriza el de la cámara, sino usa el del servidor
$current_timestamp = $event_timestamp_from_camera ?? time();

// --- GUARDAR IMAGEN DE LA MATRÍCULA ---
$image_path = null;
if (isset($image_data)) {
    // Genera un nombre de archivo único usando la matrícula, el timestamp del evento y un ID único
    $filename = $plate . '_' . date('YmdHis', $current_timestamp) . '_' . uniqid() . '.jpg';
    $image_relative_dir = 'plate_images/';
    $image_full_path = APP_ROOT . '/' . $image_relative_dir . $filename;
    $image_db_path = $image_relative_dir . $filename; // Ruta relativa para la DB

    if (!file_put_contents($image_full_path, $image_data)) {
        $log_details .= "IMAGE_SAVE_ERROR: No se pudo guardar la imagen en '{$image_full_path}'.\n";
        $image_path = null;
    } else {
        $image_path = $image_db_path; // Guarda la ruta para la DB si el guardado fue exitoso
        $log_details .= "IMAGE_SAVED: {$image_path}\n";
    }
}

// --- PROCESAR VEHÍCULO Y SESIÓN DE PARKING ---
// Busca el vehículo en la base de datos
$stmt = $pdo->prepare("SELECT v.id, v.is_whitelisted, v.is_inside, o.name as owner_name FROM vehicles v LEFT JOIN owners o ON v.owner_id = o.id WHERE v.plate = :plate");
$stmt->execute([':plate' => $plate]);
$vehicle = $stmt->fetch(PDO::FETCH_ASSOC);

$is_new_vehicle = false;
if ($vehicle) {
    $vehicle_id = $vehicle['id'];
    $decision = $vehicle['is_whitelisted'] ? 'acceso_permitido' : 'acceso_denegado';
    $is_inside = (bool)$vehicle['is_inside'];
} else {
    // Si el vehículo no existe, lo crea y lo marca como no en lista blanca y fuera
    $stmt = $pdo->prepare("INSERT INTO vehicles (plate, is_whitelisted, is_inside, created_at, updated_at) VALUES (:plate, 0, 0, FROM_UNIXTIME(:current_timestamp), FROM_UNIXTIME(:current_timestamp))");
    $stmt->execute([':plate' => $plate, ':current_timestamp' => $current_timestamp]);
    $vehicle_id = $pdo->lastInsertId();
    $decision = 'acceso_denegado'; // Por defecto, acceso denegado para vehículos nuevos
    $is_inside = false;
    $is_new_vehicle = true;
    $log_details .= "NEW_VEHICLE_CREATED: {$plate} (ID: {$vehicle_id})\n";
}

// Determina si la cámara es de entrada o salida basándose en su nombre
$is_entry_camera = (stripos($device_name, 'entrada') !== false);
$is_exit_camera = (stripos($device_name, 'salida') !== false);

// Lógica para actualizar las sesiones de parking
if ($is_entry_camera && !$is_inside) {
    // Si es cámara de entrada y el vehículo está fuera, registra una nueva sesión de entrada
    $stmt = $pdo->prepare("INSERT INTO parking_sessions (vehicle_id, entry_time, status) VALUES (?, FROM_UNIXTIME(?), 'in')");
    $stmt->execute([$vehicle_id, $current_timestamp]);
    // Actualiza el estado del vehículo a "dentro"
    $stmt = $pdo->prepare("UPDATE vehicles SET is_inside = 1, updated_at = FROM_UNIXTIME(?) WHERE id = ?");
    $stmt->execute([$current_timestamp, $vehicle_id]);
    $log_details .= "VEHICLE_ENTRY: {$plate} entered.\n";
} elseif ($is_exit_camera && $is_inside) {
    // Si es cámara de salida y el vehículo está dentro, registra el tiempo de salida de la última sesión abierta
    $stmt = $pdo->prepare("UPDATE parking_sessions SET exit_time = FROM_UNIXTIME(?), status = 'out' WHERE vehicle_id = ? AND status = 'in' ORDER BY entry_time DESC LIMIT 1");
    $stmt->execute([$current_timestamp, $vehicle_id]);
    // Actualiza el estado del vehículo a "fuera"
    $stmt = $pdo->prepare("UPDATE vehicles SET is_inside = 0, updated_at = FROM_UNIXTIME(?) WHERE id = ?");
    $stmt->execute([$current_timestamp, $vehicle_id]);
    $log_details .= "VEHICLE_EXIT: {$plate} exited.\n";
} else {
    // Si no se cumple ninguna condición para cambio de sesión, no hace nada pero lo loguea
    $log_details .= "SESSION_NO_CHANGE: Device '{$device_name}' (is_entry: " . ($is_entry_camera?'true':'false') . ", is_exit: " . ($is_exit_camera?'true':'false') . ") or vehicle status 'is_inside'=" . ($is_inside?'true':'false') . " did not trigger session change.\n";
}

// --- REGISTRAR EVENTO ---
try {
    // Inserta el evento en la tabla 'events' usando el timestamp unificado
    $stmt = $pdo->prepare("INSERT INTO events (vehicle_id, plate, timestamp, event_type, image_path, decision, notes, device_id) VALUES (?, ?, FROM_UNIXTIME(?), ?, ?, ?, ?, ?)");
    $stmt->execute([$vehicle_id, $plate, $current_timestamp, $event_type, $image_path, $decision, null, $device_id]);
    $log_details .= "EVENT_INSERT_SUCCESS.\n";
} catch (PDOException $e) {
    $log_details .= "DB_ERROR_EVENT_INSERT: " . $e->getMessage() . "\n";
}

// Escribe todos los detalles del procesamiento en el archivo de log
file_put_contents($error_log_file, $log_entry_prefix . " " . $log_details . "---\n", FILE_APPEND);

// --- RESPUESTA A LA CÁMARA ---
// Envía la respuesta XML requerida por Hikvision para confirmar la recepción
header('Content-Type: application/xml');
echo '<?xml version="1.0" encoding="UTF-8"?><ResponseStatus version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema"><requestURL>/ISAPI/Event/notification/alertStream</requestURL><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>';
?>