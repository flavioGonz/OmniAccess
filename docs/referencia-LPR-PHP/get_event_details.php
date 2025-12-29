<?php
// get_event_details.php (Versión 2.0 - Corregida y Mejorada)

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
global $pdo;

$event_id = $_GET['id'] ?? null;
if (empty($event_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID de evento no proporcionado.']);
    exit;
}

try {
    $response = [];

    // 1. Datos del evento principal
    $main_stmt = $pdo->prepare("
        SELECT e.plate, e.timestamp, e.image_path, e.decision, o.name as owner_name, l.description as lot_description, l.latitude as lot_latitude, l.longitude as lot_longitude
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id
        LEFT JOIN lots l ON ola.lot_id = l.id
        WHERE e.id = :event_id
    ");
    $main_stmt->execute([':event_id' => $event_id]);
    $event_details = $main_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$event_details) { throw new Exception("Evento no encontrado."); }
    
    // ===== CAMBIO CLAVE: Estructura del JSON de respuesta =====
    $response['details'] = $event_details;
    $plate = $response['details']['plate'];

    // 2. Historial de la matrícula
    $history_stmt = $pdo->prepare("
        SELECT e.timestamp, e.decision, d.name as device_name, d.purpose
        FROM events e
        LEFT JOIN devices d ON e.device_id = d.id
        WHERE e.plate = :plate ORDER BY e.timestamp DESC LIMIT 10
    ");
    $history_stmt->execute([':plate' => $plate]);
    $response['history'] = $history_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Coordenadas de fallback
    if (empty($response['details']['lot_latitude'])) {
        $cameras_stmt = $pdo->query("SELECT name, purpose, latitude, longitude FROM devices WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
        $response['map_fallback_locations'] = $cameras_stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode(['success' => true, 'data' => $response]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>