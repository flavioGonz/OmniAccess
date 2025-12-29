<?php
/**
 * get_main_dashboard_data.php (Versión 3.0 - KPIs extendidos)
 * Endpoint AJAX para el dashboard Geoespacial con Timelines.
 * Proporciona KPIs, feeds de actividad, rankings y estado de cámaras.
 */

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
global $pdo;

try {
    $response = [];

    // --- 1. KPIs ---
    $kpis_stmt = $pdo->query("
        SELECT
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'entry') as entries_today,
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE DATE(e.timestamp) = CURDATE() AND d.purpose = 'exit') as exits_today,
            (SELECT COUNT(e.id) FROM events e WHERE DATE(e.timestamp) = CURDATE() AND e.decision = 'acceso_denegado') as denied_today,
            (SELECT COUNT(DISTINCT e.id) FROM events e JOIN vehicles v ON e.vehicle_id = v.id WHERE v.list_type = 'supplier' AND DATE(e.timestamp) = CURDATE()) as suppliers_today
    ");
    $response['kpis'] = $kpis_stmt->fetch(PDO::FETCH_ASSOC);
    
    // KPI: Vehículo más activo de hoy
    $top_vehicle_stmt = $pdo->query("
        SELECT plate, COUNT(id) as count 
        FROM events 
        WHERE DATE(timestamp) = CURDATE() AND plate != 'UNKNOWN'
        GROUP BY plate 
        ORDER BY count DESC 
        LIMIT 1
    ");
    $response['kpis']['top_vehicle'] = $top_vehicle_stmt->fetch(PDO::FETCH_ASSOC) ?: ['plate' => 'N/A', 'count' => 0];
    
    // KPI: Ocupación Actual (del sistema de parking)
    $response['kpis']['occupancy'] = (int)$pdo->query("SELECT COUNT(*) FROM vehicles WHERE is_inside = 1")->fetchColumn();

    // Placeholder para Desconexiones (esta lógica sería más compleja, por ahora es un valor fijo)
    $response['kpis']['disconnections'] = 0;
    
    // KPI: Lista de cámaras para el widget de estado
    $cameras_stmt = $pdo->query("SELECT id, name FROM devices ORDER BY name");
    $response['kpis']['cameras'] = $cameras_stmt->fetchAll(PDO::FETCH_ASSOC);


    // --- 2. Últimas 10 Entradas (con datos para el toast) ---
    $latest_entries_stmt = $pdo->query("
        SELECT 
            e.id, 
            e.plate, 
            e.timestamp, 
            e.image_path, 
            e.decision, 
            v.list_type, 
            o.name as owner_name,
            v.owner_id, 
            GROUP_CONCAT(l.description SEPARATOR ', ') as lot_description
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id
        LEFT JOIN lots l ON ola.lot_id = l.id
        JOIN devices d ON e.device_id = d.id
        WHERE d.purpose = 'entry'
        GROUP BY e.id
        ORDER BY e.timestamp DESC
        LIMIT 10
    ");
    $response['latest_entries'] = $latest_entries_stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- 3. Últimas 10 Salidas (con datos para el toast) ---
    $latest_exits_stmt = $pdo->query("
        SELECT 
            e.id, 
            e.plate, 
            e.timestamp, 
            e.image_path, 
            e.decision, 
            v.list_type, 
            o.name as owner_name,
            v.owner_id,
            GROUP_CONCAT(l.description SEPARATOR ', ') as lot_description
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id
        LEFT JOIN lots l ON ola.lot_id = l.id
        JOIN devices d ON e.device_id = d.id
        WHERE d.purpose = 'exit'
        GROUP BY e.id
        ORDER BY e.timestamp DESC
        LIMIT 10
    ");
    $response['latest_exits'] = $latest_exits_stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $response]);

} catch (Exception $e) {
    http_response_code(500);
    // Para depuración, es útil ver el error exacto
    echo json_encode(['success' => false, 'message' => 'Error en el servidor: ' . $e->getMessage()]);
}
?>