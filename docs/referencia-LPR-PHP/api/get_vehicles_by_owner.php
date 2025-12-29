<?php
// api/get_vehicles_by_owner.php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');
$owner_id = $_GET['owner_id'] ?? 0;

if (!$owner_id) {
    echo json_encode([]);
    exit();
}

$pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
$stmt = $pdo->prepare("SELECT id, plate FROM vehicles WHERE owner_id = :owner_id ORDER BY plate ASC");
$stmt->execute([':owner_id' => $owner_id]);
$vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($vehicles);
?>