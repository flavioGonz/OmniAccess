<?php
// setup_db.php

require_once __DIR__ . '/config.php';

echo "Iniciando configuración de la base de datos...\n";

try {
    // Conectar a la base de datos MySQL
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    // Habilitar el modo de errores para PDO para que lance excepciones
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Base de datos conectada/creada en: " . DB_NAME . " en " . DB_HOST . "\n";

    // Crear la tabla 'vehicles'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS vehicles (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            plate VARCHAR(255) UNIQUE NOT NULL,\n            description TEXT DEFAULT '',\n            is_whitelisted TINYINT(1) DEFAULT 0,\n            created_at DATETIME,\n            updated_at DATETIME\n        );\n    ");
    echo "Tabla 'vehicles' creada o ya existe.\n";

    // Crear la tabla 'events'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS events (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            vehicle_id INT,\n            plate VARCHAR(255) NOT NULL,\n            timestamp INT NOT NULL,\n            event_type VARCHAR(255) NOT NULL,\n            image_path VARCHAR(255),\n            decision VARCHAR(255),\n            notes TEXT,\n            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)\n        );\n    ");
    echo "Tabla 'events' creada o ya existe.\n";

    // --- NUEVAS TABLAS PARA CENTRALIZAR DATOS ---

    // Crear la tabla 'owners'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS owners (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            owner_uid VARCHAR(255) UNIQUE NOT NULL,\n            name VARCHAR(255) NOT NULL,\n            email VARCHAR(255),\n            phone VARCHAR(255),\n            address TEXT,\n            photo_path VARCHAR(255),\n            created_at DATETIME NOT NULL\n        );\n    ");
    echo "Tabla 'owners' creada o ya existe.\n";

    // Crear la tabla 'lots'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS lots (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            lot_uid VARCHAR(255) UNIQUE NOT NULL,\n            description TEXT,\n            latitude DOUBLE,\n            longitude DOUBLE,\n            created_at DATETIME NOT NULL\n        );\n    ");
    echo "Tabla 'lots' creada o ya existe.\n";

    // Crear la tabla 'users'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS users (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            username VARCHAR(255) UNIQUE NOT NULL,\n            password_hash VARCHAR(255) NOT NULL,\n            created_at DATETIME NOT NULL\n        );\n    ");
    echo "Tabla 'users' creada o ya existe.\n";

    // Crear la tabla 'devices'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS devices (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            name VARCHAR(255) UNIQUE NOT NULL,\n            ip VARCHAR(255) NOT NULL,\n            username VARCHAR(255) NOT NULL,\n            password VARCHAR(255) NOT NULL,\n            created_at DATETIME NOT NULL\n        );\n    ");
    echo "Tabla 'devices' creada o ya existe.\n";

    // Crear la tabla de asociación 'owner_lot_associations'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS owner_lot_associations (\n            owner_id INT NOT NULL,\n            lot_id INT NOT NULL,\n            PRIMARY KEY (owner_id, lot_id),\n            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,\n            FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE\n        );\n    ");
    echo "Tabla 'owner_lot_associations' creada o ya existe.\n";

    // Crear la tabla 'parking_sessions'
    $pdo->exec("\n        CREATE TABLE IF NOT EXISTS parking_sessions (\n            id INT AUTO_INCREMENT PRIMARY KEY,\n            vehicle_id INT NOT NULL,\n            entry_time INT NOT NULL,\n            exit_time INT,\n            status VARCHAR(50) NOT NULL, -- 'in' or 'out'\n            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)\n        );\n    ");
    echo "Tabla 'parking_sessions' creada o ya existe.\n";

    // Modificar la tabla 'vehicles' para añadir la relación con 'owners' y 'is_inside'
    try {
        $pdo->exec("ALTER TABLE vehicles ADD COLUMN owner_id INT REFERENCES owners(id) ON DELETE SET NULL");
        echo "Columna 'owner_id' añadida a la tabla 'vehicles'.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column name') === false) { throw $e; }
        echo "Columna 'owner_id' ya existe en la tabla 'vehicles'.\n";
    }
    try {
        $pdo->exec("ALTER TABLE vehicles ADD COLUMN is_inside TINYINT(1) DEFAULT 0");
        echo "Columna 'is_inside' añadida a la tabla 'vehicles'.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column name') === false) { throw $e; }
        echo "Columna 'is_inside' ya existe en la tabla 'vehicles'.\n";
    }

    // Modificar la tabla 'events' para añadir device_id
    try {
        $pdo->exec("ALTER TABLE events ADD COLUMN device_id INT REFERENCES devices(id)");
        echo "Columna 'device_id' añadida a la tabla 'events'.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column name') === false) { throw $e; }
        echo "Columna 'device_id' ya existe en la tabla 'events'.\n";
    }

    echo "Configuración de la base de datos finalizada con éxito.\n";

} catch (PDOException $e) {
    echo "Error de base de datos: " . $e->getMessage() . "\n";
    error_log("Error en setup_db.php: " . $e->getMessage());
} catch (Exception $e) {
    echo "Error general: " . $e->getMessage() . "\n";
    error_log("Error en setup_db.php: " . $e->getMessage());
}

?>