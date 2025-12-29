<?php
// get_camera_whitelist.php (Versión Mejorada con enriquecimiento de datos)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api_helpers.php'; 

header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'data' => []];
$device_id = $_GET['id'] ?? null;

if (!$device_id) {
    $response['message'] = 'No se proporcionó un ID de dispositivo.';
    echo json_encode($response);
    exit();
}

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("SELECT ip, username, password FROM devices WHERE id = :id");
    $stmt->execute([':id' => $device_id]);
    $camera = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$camera) {
        $response['message'] = 'Dispositivo no encontrado.';
    } else {
        // 1. Obtener la lista blanca de la cámara
        $camera_result = getWhitelistFromCamera($camera);
        
        if ($camera_result['success']) {
            $plates_from_camera = $camera_result['data'];
            $enriched_plates = [];

            // 2. Si hay matrículas, las enriquecemos con datos locales
            if (!empty($plates_from_camera)) {
                // Preparamos un array solo con los números de matrícula para la consulta SQL
                $plate_numbers = array_column($plates_from_camera, 'plate_number');
                
                // Creamos los placeholders para la consulta IN (...)
                $placeholders = implode(',', array_fill(0, count($plate_numbers), '?'));

                // Consultamos nuestra DB para encontrar los propietarios de estas matrículas
                $sql = "
                    SELECT v.plate, o.name as owner_name 
                    FROM vehicles v 
                    LEFT JOIN owners o ON v.owner_id = o.id 
                    WHERE v.plate IN ($placeholders)
                ";
                $stmt_local = $pdo->prepare($sql);
                $stmt_local->execute($plate_numbers);
                $local_data = $stmt_local->fetchAll(PDO::FETCH_KEY_PAIR); // Crea un array [plate => owner_name]

                // 3. Unimos los datos de la cámara con los datos locales
                foreach ($plates_from_camera as $plate_info) {
                    $plate = $plate_info['plate_number'];
                    $enriched_plates[] = [
                        'plate_number' => $plate,
                        'owner_name' => $local_data[$plate] ?? 'No Registrado' // Si no encontramos propietario, lo indicamos
                    ];
                }
            }
            
            $response['success'] = true;
            $response['message'] = 'Lista blanca obtenida y enriquecida con éxito.';
            $response['data'] = $enriched_plates; // Devolvemos la lista enriquecida

        } else {
            $response['message'] = $camera_result['data'];
        }
    }
} catch (Exception $e) {
    $response['message'] = 'Error del servidor: ' . $e->getMessage();
}

echo json_encode($response);


// --- Este script actúa como el orquestador que une la comunicación con la cámara y la base de datos local para la función de auditoría.
// --- Endpoint API: Sirve como un endpoint AJAX, recibiendo un id de dispositivo como parámetro GET.
// --- Recuperación de Credenciales: Obtiene la IP y las credenciales de la cámara desde la base de datos.
// --- Llamada a la Librería: Invoca la función getWhitelistFromCamera de api_helpers.php para realizar la comunicación real con la cámara.
// --- Enriquecimiento de Datos: Esta es la parte más inteligente. Una vez que obtiene la lista de matrículas de la cámara, no se limita a devolverla. Realiza una única y eficiente consulta SQL a la base de datos local (usando IN (...)) para buscar los propietarios de todas esas matrículas a la vez.
// --- Fusión de Datos: Combina los resultados de la cámara con los de la base de datos local. Si una matrícula de la cámara no tiene un propietario registrado en el sistema, lo marca explícitamente como "No Registrado".
// --- Respuesta JSON: Devuelve una respuesta JSON estructurada que contiene la lista final de matrículas enriquecidas, lista para ser consumida por el JavaScript del frontend.
?>

