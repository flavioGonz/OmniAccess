<?php
// config.php (Versión Final con Conexión PDO Global)

// 1. INICIO DE SESIÓN
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. GUARDIÁN DE AUTENTICACIÓN
$script_name = basename($_SERVER['PHP_SELF']);
$allowed_unauthenticated = ['login.php', 'auth.php', 'webhook.php'];

if (!isset($_SESSION['user_id']) && !in_array($script_name, $allowed_unauthenticated)) {
    header('Location: login.php');
    exit;
}

// 3. CONSTANTES DE LA APLICACIÓN
define('APP_ROOT', __DIR__);

// --- Configuración de la base de datos MySQL ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'lpr_db');
define('DB_USER', 'root');
define('DB_PASS', '');

// --- Configuración de la zona horaria para PHP ---
date_default_timezone_set('America/Argentina/Buenos_Aires');


// 4. CONEXIÓN PDO GLOBAL
// Esta conexión se crea una sola vez y estará disponible en todos los
// scripts que incluyan config.php (como index.php y tus endpoints AJAX).
global $pdo;
$pdo = null; // Inicializamos por si falla la conexión

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    // Si la conexión falla, detenemos todo y mostramos un error claro.
    // Esto previene errores extraños en otras partes del código.
    // Verificamos si la petición es para una API para no romper el JSON.
    if (strpos($_SERVER['REQUEST_URI'], '.php') !== false && !in_array($script_name, ['index.php'])) {
        header('Content-Type: application/json');
        http_response_code(500);
        die(json_encode([
            'success' => false,
            'message' => 'Error crítico de conexión a la base de datos.'
        ]));
    } else {
        die('<div style="font-family: sans-serif; padding: 2rem; border: 2px solid red; margin: 2rem; border-radius: 8px;"><h1>Error Crítico de Conexión</h1><p>No se pudo conectar a la base de datos.</p><p>Detalle: ' . htmlspecialchars($e->getMessage()) . '</p></div>');
    }
}


// 5. FUNCIONES DE SEGURIDAD (CSRF)
function generate_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validate_csrf_token($token) {
    if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        return false;
    }
    return true;
}

?>