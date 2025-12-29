<?php
// check_devices.php
require_once __DIR__ . '/config.php';

echo "<pre>";
echo "Listando dispositivos desde la base de datos...\n\n";

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->query("SELECT id, name, ip FROM devices");
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($devices) {
        print_r($devices);
    } else {
        echo "No se encontraron dispositivos en la base de datos.";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}

echo "</pre>";
?>