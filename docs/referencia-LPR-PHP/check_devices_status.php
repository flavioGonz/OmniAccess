<?php
// check_devices_status.php (Versión con cuerpo XML)

require_once __DIR__ . '/config.php';
header('Content-Type: application/json');
set_time_limit(60);

$response = [];

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $devices = $pdo->query("SELECT id, name, ip, username, password FROM devices")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($devices as $camera) {
        $status = ['id' => $camera['id'], 'status' => 'error', 'message' => ''];
        
        // La URL ya no necesita ?format=json porque el formato de respuesta
        // a menudo se define en el header Accept o es XML por defecto.
        $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/searchLPListAudit";

        // --- CAMBIO CLAVE: Construimos el cuerpo de la petición en XML ---
        $xml_data = '<?xml version="1.0" encoding="UTF-8"?><LPSearchCond><searchID>1</searchID><maxResult>1</maxResult><searchResultPosition>0</searchResultPosition></LPSearchCond>';

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
            CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $xml_data, // Enviamos el XML
            CURLOPT_HTTPHEADER => ['Content-Type: application/xml'], // Indicamos que el contenido es XML
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'Mozilla/5.0'
        ]);

        $api_response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);

        if ($curl_error) {
            $status['message'] = "Error cURL: " . $curl_error;
        } elseif ($http_code === 200) {
            // Si la respuesta es 200, la conexión es buena, independientemente del contenido.
            $status['status'] = 'ok';
            $status['message'] = 'Conexión exitosa.';
        } else {
            $status['message'] = "Error HTTP {$http_code}. Respuesta: " . strip_tags($api_response);
        }
        
        $response[] = $status;
    }
} catch (Exception $e) {
    http_response_code(500);
    $response = ['error' => true, 'message' => $e->getMessage()];
}

echo json_encode($response);


// --- Este script es un endpoint de servicio diseñado para verificar la salud de todas las cámaras configuradas.
// --- Iteración sobre Dispositivos: Obtiene la lista completa de dispositivos de la base de datos y los recorre uno por uno.
// --- Petición de Diagnóstico: Para cada cámara, realiza una petición cURL al endpoint searchLPListAudit. La decisión de usar este endpoint con maxResult=1 es inteligente, ya que es una operación de bajo impacto para la cámara y a la vez confirma:
// --- Conectividad de red (se puede alcanzar la IP y el puerto).
// --- Validez de las credenciales (la autenticación Digest funciona).
// --- Disponibilidad del servicio API de la cámara.
// --- Manejo de Tiempos de Espera: Utiliza CURLOPT_TIMEOUT y CURLOPT_CONNECTTIMEOUT para evitar que el script se bloquee indefinidamente si una cámara no responde.
// --- Clasificación del Estado: Basándose en la respuesta de cURL (error, código HTTP), clasifica el estado de cada cámara como "ok" o "error" y construye un mensaje descriptivo.
// --- Respuesta Agregada: Devuelve un único array JSON que contiene el estado (id, status, message) de cada uno de los dispositivos, listo para que el frontend lo procese y actualice los LEDs.
?>

