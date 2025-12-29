<?php
// temp_alter_table.php
$db_host = 'localhost';
$db_name = 'lpr_db';
$db_user = 'root';
$db_pass = '';

try {
    $dsn = 'mysql:host=' . $db_host . ';dbname=' . $db_name . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "ALTER TABLE vehicles ADD COLUMN country VARCHAR(50) NOT NULL DEFAULT 'ARGENTINA'";
    $pdo->exec($sql);
    echo 'Columna \'country\' añadida a la tabla \'vehicles\' con éxito.';
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo 'La columna \'country\' ya existe en la tabla \'vehicles\'.';
    } else {
        echo 'Error al añadir columna: ' . $e->getMessage();
    }
}
?>