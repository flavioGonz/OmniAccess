<?php
// force_sync_whitelist.php

set_time_limit(300); 

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php';

header('Content-Type: application/json');
global $pdo;

$input = json_decode(file_get_contents('php://input'), true);
$camera_id = $input['camera_id'] ?? null;

if (empty($camera_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No se proporcionó ID de cámara.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM devices WHERE id = ?");
    $stmt->execute([$camera_id]);
    $camera = $stmt->fetch();
    if (!$camera) {
        throw new Exception("Cámara no encontrada en la base de datos.");
    }

    $whitelist_stmt = $pdo->query("SELECT plate FROM vehicles WHERE list_type = 'whitelist'");
    $db_whitelist = $whitelist_stmt->fetchAll(PDO::FETCH_COLUMN);

    $delete_result = deleteAllPlatesFromCamera($camera);
    if (!$delete_result['success']) {
        throw new Exception("Fallo en el paso 1 (Borrar todo): " . $delete_result['message']);
    }

    $errors = [];
    $success_count = 0;
    foreach ($db_whitelist as $plate) {
        usleep(100000); // 100ms de retraso para no saturar la cámara
        $add_result = addPlateToCameraWhitelist($camera, $plate);
        if ($add_result['success']) {
            $success_count++;
        } else {
            $errors[] = "Error al añadir {$plate}: " . $add_result['message'];
        }
    }

    $summary = "Sincronización completada. Matrículas añadidas: {$success_count}/" . count($db_whitelist) . ".";
    if (!empty($errors)) {
        $summary .= " Se encontraron " . count($errors) . " errores.";
    }

    echo json_encode([
        'success' => true, 
        'message' => $summary,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>