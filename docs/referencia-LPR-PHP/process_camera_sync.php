<?php
// process_camera_sync.php (Versión Final)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php';

header('Content-Type: application/json');
global $pdo;

$input = json_decode(file_get_contents('php://input'), true);

$action = $input['action'] ?? null;
$plate = $input['plate'] ?? null;
$camera_ids = $input['camera_ids'] ?? [];

if (!$action || !$plate || empty($camera_ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Datos incompletos.']);
    exit;
}

try {
    $placeholders = implode(',', array_fill(0, count($camera_ids), '?'));
    $stmt = $pdo->prepare("SELECT id, name, ip, username, password FROM devices WHERE id IN ($placeholders)");
    $stmt->execute($camera_ids);
    $cameras = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];

    foreach ($cameras as $camera) {
        if ($action === 'add') {
            $result = addPlateToCameraWhitelist($camera, $plate);
            $results[] = array_merge($result, ['camera_name' => $camera['name']]);
        } 
        elseif ($action === 'delete') {
            $result = deletePlateFromCameraWhitelist($camera, $plate);
            $results[] = array_merge($result, ['camera_name' => $camera['name']]);
        }
    }

    echo json_encode(['success' => true, 'details' => $results]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>