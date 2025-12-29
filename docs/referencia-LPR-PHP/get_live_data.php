<?php
// get_live_data.php (Versión Final - Sin Latitud/Longitud)

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate'); // Evitar caché
header('Pragma: no-cache');
header('Expires: 0');

// --- CONEXIÓN A LA BASE DE DATOS ---
$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $e) {
    // En caso de error de DB, devolver un array vacío y loguear el error.
    error_log(date('[Y-m-d H:i:s]') . " Error en get_live_data.php al conectar a DB: " . $e->getMessage() . "\n");
    // Siempre devolver una estructura JSON válida, incluso si está vacía
    echo json_encode(['events' => [], 'debug_device_names' => []]); 
    exit();
}

// --- OBTENER LOS ÚLTIMOS EVENTOS DE LA BASE DE DATOS ---
// Obtener los últimos 20 eventos, ordenados por timestamp descendente para obtener los más nuevos.
// Incluye el nombre del propietario y los nombres de los lotes asociados.
$sql = "
    SELECT
        e.id,
        e.plate,
        UNIX_TIMESTAMP(e.timestamp) AS timestamp, -- Obtener timestamp Unix directamente de la DB
        e.decision,
        e.image_path,
        e.notes,
        v.is_whitelisted,
        v.is_inside,
        d.name AS device_name,
        o.name AS owner_name,
        GROUP_CONCAT(l.description SEPARATOR ', ') AS lot_names
    FROM
        events e
    LEFT JOIN
        vehicles v ON e.vehicle_id = v.id
    LEFT JOIN
        owners o ON v.owner_id = o.id
    LEFT JOIN
        owner_lot_associations ola ON o.id = ola.owner_id
    LEFT JOIN
        lots l ON ola.lot_id = l.id
    LEFT JOIN
        devices d ON e.device_id = d.id
    GROUP BY
        e.id, e.plate, e.timestamp, e.decision, e.image_path, e.notes, v.is_whitelisted, v.is_inside, d.name, o.name
    ORDER BY
        e.timestamp DESC, e.id DESC -- Ordenar por timestamp y luego por ID para los más recientes
    LIMIT 20
";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$raw_events = $stmt->fetchAll(PDO::FETCH_ASSOC);

$formatted_events = [];
$debug_device_names = []; // Para depuración

foreach ($raw_events as $event) {
    // Asegurarse de que device_name no sea nulo o vacío antes de añadirlo
    if (!empty($event['device_name'])) {
        $debug_device_names[] = $event['device_name'];
    }
    $formatted_events[] = [
        'id'          => $event['id'],
        'plate'       => htmlspecialchars($event['plate']),
        // Formatear el timestamp directamente a una cadena legible para el frontend
        'datetime'    => date('Y-m-d H:i:s', (int)$event['timestamp']),
        'decision'    => htmlspecialchars($event['decision']),
        // Asegurarse de que la ruta de la imagen sea absoluta y correcta para el navegador
        'image_path'  => htmlspecialchars('/LPR/' . ($event['image_path'] ?? 'placeholder.jpg')), // Añadido placeholder por si acaso
        'device_name' => htmlspecialchars($event['device_name'] ?? 'Desconocido'),
        'owner_name'  => htmlspecialchars($event['owner_name'] ?? 'Desconocido'),
        'lot_names'   => htmlspecialchars($event['lot_names'] ?? 'N/A'),
        'notes'       => htmlspecialchars($event['notes'] ?? ''),
        'is_inside'   => (bool)($event['is_inside'] ?? 0)
    ];
}

// Devuelve los eventos formateados y los nombres de dispositivos para depuración
echo json_encode([
    'events' => $formatted_events,
    'debug_device_names' => array_values(array_unique($debug_device_names))
]);

?>