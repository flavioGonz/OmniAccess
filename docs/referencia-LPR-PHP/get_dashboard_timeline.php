<?php
// get_dashboard_timeline.php

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
global $pdo;

try {
    $response = [];

    // 1. KPIs
    // Esta consulta ahora une con 'devices' para filtrar por propósito, lo cual es más preciso.
    $kpis_stmt = $pdo->query("
        SELECT
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'entry') as entries_today,
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'exit') as exits_today
    ");
    $response['kpis'] = $kpis_stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Últimos 15 eventos para el timeline (con la información necesaria para el popup)
    $latest_events_stmt = $pdo->query("
        SELECT 
            e.id, 
            e.plate, 
            e.timestamp, 
            e.image_path, 
            e.decision, 
            v.list_type,
            o.name as owner_name,
            d.purpose as device_purpose
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN devices d ON e.device_id = d.id
        ORDER BY e.timestamp DESC
        LIMIT 15
    ");
    $response['timeline_events'] = $latest_events_stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $response]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>