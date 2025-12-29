<?php
// get_main_dashboard_data.php

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
global $pdo;

try {
    $response = [];

    // 1. KPIs
    $kpi_stmt = $pdo->query("
        SELECT
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'entry') as entries_today,
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'exit') as exits_today,
            (SELECT COUNT(e.id) FROM events e WHERE DATE(e.timestamp) = CURDATE() AND e.decision = 'acceso_denegado') as denied_today
    ");
    $response['kpis'] = $kpi_stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Últimas 5 Entradas para el feed
    $latest_entries_stmt = $pdo->query("
        SELECT e.id, e.plate, e.timestamp, e.image_path, e.decision, v.list_type, o.name as owner_name
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        JOIN devices d ON e.device_id = d.id
        WHERE d.purpose = 'entry'
        ORDER BY e.timestamp DESC
        LIMIT 5
    ");
    $response['latest_entries'] = $latest_entries_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Últimas 5 Salidas para el feed
    $latest_exits_stmt = $pdo->query("
        SELECT e.id, e.plate, e.timestamp, e.image_path, e.decision, v.list_type, o.name as owner_name
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        JOIN devices d ON e.device_id = d.id
        WHERE d.purpose = 'exit'
        ORDER BY e.timestamp DESC
        LIMIT 5
    ");
    $response['latest_exits'] = $latest_exits_stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $response]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>