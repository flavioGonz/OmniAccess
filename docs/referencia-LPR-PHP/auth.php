<?php
// auth.php (Versión CORREGIDA Y COMPLETA)
require_once __DIR__ . '/config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Conexión a la BD
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    $_SESSION['login_error'] = 'Error interno del servidor.';
    header('Location: login.php');
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // --- LÓGICA DE LOGIN ---
    
    if (!isset($_POST['csrf_token']) || !validate_csrf_token($_POST['csrf_token'])) {
        $_SESSION['login_error'] = 'Error de seguridad. Intente de nuevo.';
        header('Location: login.php');
        exit;
    }

    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        $_SESSION['login_error'] = 'Usuario y contraseña son requeridos.';
        header('Location: login.php');
        exit;
    }

    // ==========================================================
    // INICIO DE LA CORRECCIÓN CLAVE
    // ==========================================================
    
    // Buscar al usuario en la base de datos usando la columna correcta: `password_hash`
    $stmt = $pdo->prepare("SELECT id, username, password_hash FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Verificar la contraseña contra la columna correcta: `password_hash`
    if ($user && password_verify($password, $user['password_hash'])) {
        
    // ==========================================================
    // FIN DE LA CORRECCIÓN CLAVE
    // ==========================================================
        
        // ¡Credenciales correctas! Iniciar sesión.
        
        session_regenerate_id(true); 

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        
        header('Location: index.php?page=dashboard');
        exit;
    } else {
        // Credenciales incorrectas
        $_SESSION['login_error'] = 'Usuario o contraseña incorrectos.';
        header('Location: login.php');
        exit;
    }

} elseif ($action === 'logout') {
    // --- LÓGICA DE LOGOUT ---
    
    session_unset();
    session_destroy();
    
    session_start();
    $_SESSION['logout_message'] = 'Has cerrado sesión correctamente.';
    
    header('Location: login.php');
    exit;

} else {
    header('Location: login.php');
    exit;
}