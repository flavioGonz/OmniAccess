<?php
// check_plate_on_cameras.php (Backend para verificar estado de sincronización)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php';

header('Content-Type: application/json');
global $pdo;

$plate = $_GET['plate'] ?? null;
if (empty($plate)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No se proporcionó matrícula.']);
    exit;
}

try {
    $cameras_stmt = $pdo->query("SELECT id, name, ip, username, password FROM devices");
    $all_cameras = $cameras_stmt->fetchAll(PDO::FETCH_ASSOC);

    $status_by_camera = [];

    foreach ($all_cameras as $camera) {
        // Usamos @ para suprimir advertencias de cURL que pueden romper el JSON si la cámara está offline
        $result = @getWhitelistFromCamera($camera);

        $found = false;
        if (isset($result['success']) && $result['success'] && is_array($result['data'])) {
            // Buscamos la matrícula en los datos devueltos
            foreach ($result['data'] as $plate_info) {
                if (isset($plate_info['plate_number']) && strtoupper($plate_info['plate_number']) === strtoupper($plate)) {
                    $found = true;
                    break;
                }
            }
        }
        
        $status_by_camera[] = [
            'camera_id'   => $camera['id'],
            'camera_name' => $camera['name'],
            'is_present'  => $found,
            'is_online'   => (isset($result['success']) && $result['success'])
        ];
    }

    echo json_encode(['success' => true, 'data' => $status_by_camera]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>