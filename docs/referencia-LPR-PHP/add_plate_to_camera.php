<?php
// add_plate_to_camera.php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php'; // Asegúrate de que esto exista y tenga call_camera_api

header('Content-Type: application/json');

// Leer el JSON del cuerpo de la solicitud
$input = json_decode(file_get_contents('php://input'), true);

$device_id = $input['device_id'] ?? null;
$plate_number = strtoupper(trim($input['plate_number'] ?? ''));

// Si usas CSRF, valida aquí el token enviado en el header 'X-CSRF-Token'
// $csrf_token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
// if (!validate_csrf_token($csrf_token)) {
//     echo json_encode(['success' => false, 'message' => 'Error de seguridad (CSRF).']);
//     exit();
// }


$response = ['success' => false, 'message' => ''];

if (empty($device_id) || empty($plate_number)) {
    $response['message'] = 'ID de dispositivo o número de matrícula no proporcionado.';
    echo json_encode($response);
    exit();
}

$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("SELECT id, ip, username, password FROM devices WHERE id = :id");
    $stmt->execute([':id' => $device_id]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        $response['message'] = 'Dispositivo no encontrado.';
        echo json_encode($response);
        exit();
    }

    $camera_ip_port = $device['ip'];
    $camera_username = $device['username'];
    // IMPORTANTE: Aquí deberías descifrar la contraseña si la tienes encriptada
    $camera_password = $device['password']; 

    // --- Endpoint de la API REAL ENCONTRADO para añadir matrícula ---
    $channel_id = '1'; 
    $api_endpoint = "/ISAPI/Traffic/channels/{$channel_id}/licensePlateAuditData/record?format=json";
    $method = 'PUT'; 

    // --- CONSTRUCCIÓN DEL JSON ---
    $current_time_iso = (new DateTime())->format('Y-m-d\TH:i:s');
    $current_date = (new DateTime())->format('Y-m-d');

    $json_data = [
        "LicensePlateInfoList" => [
            [
                "LicensePlate" => $plate_number,
                "listType" => "whiteList",
                "createTime" => $current_time_iso,
                "effectiveStartDate" => $current_date,
                "effectiveTime" => $current_date, 
                "id" => "" 
            ]
        ]
    ];
    $json_body = json_encode($json_data);

    // Asumiendo que api_helpers.php tiene la función para hacer la llamada
    $camera_api_result = call_camera_api($camera_ip_port, $camera_username, $camera_password, $api_endpoint, $method, $json_body, 'application/json');

    if ($camera_api_result['success']) {
        $response = ['success' => true, 'message' => 'Matrícula añadida exitosamente a la cámara.'];
    } else {
        $response = ['success' => false, 'message' => 'Error al añadir matrícula a la cámara: ' . ($camera_api_result['message'] ?? 'Error desconocido en la API de la cámara.')];
    }

} catch (PDOException $e) {
    $response['message'] = "Error de base de datos: " . $e->getMessage();
} catch (Exception $e) {
    $response['message'] = "Error inesperado: " . $e->getMessage();
}

echo json_encode($response);
exit();