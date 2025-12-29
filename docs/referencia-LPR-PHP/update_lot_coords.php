<?php
// update_lot_coords.php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
global $pdo;

// Obtenemos los datos enviados como JSON
$input = json_decode(file_get_contents('php://input'), true);

$lot_id = $input['lot_id'] ?? null;
$lat = $input['lat'] ?? null;
$lng = $input['lng'] ?? null;
$csrf_token = $input['csrf_token'] ?? null;

// Validaciones
if (!validate_csrf_token($csrf_token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Error de seguridad CSRF.']);
    exit;
}
if (empty($lot_id) || !is_numeric($lat) || !is_numeric($lng)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Datos inválidos.']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE lots SET latitude = :lat, longitude = :lng WHERE id = :id");
    $stmt->execute([
        ':lat' => $lat,
        ':lng' => $lng,
        ':id' => $lot_id
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Coordenadas del lote actualizadas con éxito.']);
    } else {
        // Esto puede pasar si las coordenadas no cambiaron o el ID del lote no existe
        echo json_encode(['success' => false, 'message' => 'No se realizaron cambios o el lote no fue encontrado.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
}
?>