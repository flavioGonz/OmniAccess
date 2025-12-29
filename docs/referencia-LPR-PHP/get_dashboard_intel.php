<?php
/**
 * get_dashboard_intel.php
 * Endpoint AJAX para alimentar el "Panel de Inteligencia Operativa".
 * Proporciona KPIs, feeds de actividad y rankings en una sola llamada.
 */

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
global $pdo;

try {
    $response = [];

    // 1. KPIs (últimas 24 horas y totales)
    $kpis_stmt = $pdo->query("
        SELECT
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE e.timestamp >= NOW() - INTERVAL 24 HOUR AND d.purpose = 'entry') as entries_24h,
            (SELECT COUNT(e.id) FROM events e JOIN devices d ON e.device_id = d.id WHERE e.timestamp >= NOW() - INTERVAL 24 HOUR AND d.purpose = 'exit') as exits_24h,
            (SELECT COUNT(e.id) FROM events e JOIN vehicles v ON e.vehicle_id = v.id WHERE e.timestamp >= NOW() - INTERVAL 24 HOUR AND v.list_type = 'blacklist') as blacklist_alerts_24h,
            (SELECT COUNT(DISTINCT e.plate) FROM events e WHERE DATE(e.timestamp) = CURDATE()) as unique_today
    ");
    $response['kpis'] = $kpis_stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Feed de Actividad Principal (últimos 8 eventos)
    $feed_stmt = $pdo->query("
        SELECT e.id, e.plate, e.timestamp, e.image_path, e.decision, v.list_type, o.name as owner_name, d.name as device_name, d.purpose as device_purpose
        FROM events e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN devices d ON e.device_id = d.id
        ORDER BY e.timestamp DESC
        LIMIT 8
    ");
    $response['activity_feed'] = $feed_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Alertas de Lista Negra (últimas 5 de hoy)
    $blacklist_stmt = $pdo->query("
        SELECT e.plate, e.timestamp, d.name as device_name, o.name as owner_name
        FROM events e
        JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN devices d ON e.device_id = d.id
        LEFT JOIN owners o ON v.owner_id = o.id
        WHERE v.list_type = 'blacklist' AND DATE(e.timestamp) = CURDATE()
        ORDER BY e.timestamp DESC
        LIMIT 5
    ");
    $response['blacklist_alerts'] = $blacklist_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Actividad de Proveedores (últimas 5 entradas de hoy)
    $supplier_stmt = $pdo->query("
        SELECT e.plate, e.timestamp, d.name as device_name, o.name as owner_name
        FROM events e
        JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN devices d ON e.device_id = d.id
        LEFT JOIN owners o ON v.owner_id = o.id
        WHERE v.list_type = 'supplier' AND d.purpose = 'entry' AND DATE(e.timestamp) = CURDATE()
        ORDER BY e.timestamp DESC
        LIMIT 5
    ");
    $response['supplier_activity'] = $supplier_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Flujo horario
    $hourly_flow_stmt = $pdo->query("
        SELECT HOUR(e.timestamp) as hour,
            SUM(CASE WHEN d.purpose = 'entry' THEN 1 ELSE 0 END) as entries,
            SUM(CASE WHEN d.purpose = 'exit' THEN 1 ELSE 0 END) as exits
        FROM events e
        LEFT JOIN devices d ON e.device_id = d.id
        WHERE DATE(e.timestamp) = CURDATE()
        GROUP BY HOUR(e.timestamp) ORDER BY hour ASC
    ");
    $hourly_data = $hourly_flow_stmt->fetchAll(PDO::FETCH_ASSOC);
    $flow_by_hour = array_fill(0, 24, ['entries' => 0, 'exits' => 0]);
    foreach ($hourly_data as $data) {
        $flow_by_hour[(int)$data['hour']] = ['entries' => (int)$data['entries'], 'exits' => (int)$data['exits']];
    }
    $response['hourly_flow'] = $flow_by_hour;

    // 6. ÚLTIMA CAPTURA POR CÁMARA
    $live_cameras_stmt = $pdo->query("
        SELECT 
            d.name as device_name, 
            e.plate, 
            e.timestamp, 
            e.image_path
        FROM devices d
        LEFT JOIN events e ON e.id = (
            SELECT id FROM events 
            WHERE device_id = d.id 
            ORDER BY timestamp DESC 
            LIMIT 1
        )
        ORDER BY d.name ASC
    ");
    $response['live_cameras'] = $live_cameras_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 7. LOTES MÁS TRANSITADOS (HOY)
    $top_lots_stmt = $pdo->query("
        SELECT l.description, COUNT(e.id) as event_count
        FROM events e
        JOIN vehicles v ON e.vehicle_id = v.id
        JOIN owners o ON v.owner_id = o.id
        JOIN owner_lot_associations ola ON o.id = ola.owner_id
        JOIN lots l ON ola.lot_id = l.id
        WHERE DATE(e.timestamp) = CURDATE()
        GROUP BY l.id, l.description
        ORDER BY event_count DESC
        LIMIT 5
    ");
    $response['top_lots'] = $top_lots_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 8. VEHÍCULOS MÁS RECURRENTES (HOY)
    $top_vehicles_stmt = $pdo->query("
        SELECT 
            e.plate, 
            COUNT(e.id) as event_count,
            (SELECT image_path FROM events WHERE plate = e.plate AND image_path IS NOT NULL AND image_path != '' ORDER BY timestamp DESC LIMIT 1) as latest_image
        FROM events e
        WHERE DATE(e.timestamp) = CURDATE() AND e.plate != 'UNKNOWN'
        GROUP BY e.plate
        ORDER BY event_count DESC
        LIMIT 5
    ");
    $response['top_vehicles'] = $top_vehicles_stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $response]);

} catch (Exception $e) {
    http_response_code(500);
    // Para depuración, es útil ver el error exacto
    echo json_encode(['success' => false, 'message' => 'Error en el servidor: ' . $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
?>