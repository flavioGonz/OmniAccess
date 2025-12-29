<?php
// get_event_details.php

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'data' => null];
$event_id = $_GET['id'] ?? null;

if (!$event_id || !is_numeric($event_id)) {
    $response['message'] = 'ID de evento inválido o no proporcionado.';
    echo json_encode($response);
    exit();
}

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "
        SELECT 
            e.id, e.plate, e.timestamp, e.image_path, e.decision, e.notes,
            d.name as device_name,
            v.is_whitelisted,
            v.country as vehicle_country, -- AÑADIDO: Columna country
            o.name as owner_name, o.phone as owner_contact,
            GROUP_CONCAT(l.description SEPARATOR ', ') as lot_description
        FROM events e
        LEFT JOIN devices d ON e.device_id = d.id
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        LEFT JOIN owners o ON v.owner_id = o.id
        LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id
        LEFT JOIN lots l ON ola.lot_id = l.id
        WHERE e.id = :event_id
        GROUP BY e.id, v.country -- AÑADIDO: v.country al GROUP BY
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':event_id' => $event_id]);
    $event_data = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($event_data) {
        // Asegurarse de que el país esté en los datos devueltos
        $event_data['country'] = htmlspecialchars($event_data['vehicle_country'] ?? 'DESCONOCIDO');
        unset($event_data['vehicle_country']); // Eliminar la columna original si no se necesita

        $response['success'] = true;
        $response['data'] = $event_data;
    } else {
        $response['message'] = 'No se encontró ningún evento con el ID proporcionado.';
    }

} catch (Exception $e) {
    $response['message'] = 'Error del servidor: ' . $e->getMessage();
    http_response_code(500);
}

echo json_encode($response);
?>