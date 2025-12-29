<?php
// config.php (Versión corregida para permitir webhook)

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ==========================================================
// INICIO: GUARDIÁN DE AUTENTICACIÓN
// ==========================================================
// Este bloque protege todas las páginas que requieren inicio de sesión de usuario.
// Se añade una excepción para 'webhook.php', ya que es un script al que accede
// una máquina (la cámara), no un usuario, y por tanto no tendrá sesión.
if (
    !isset($_SESSION['user_id']) && 
    !in_array(basename($_SERVER['PHP_SELF']), ['login.php', 'auth.php', 'webhook.php']) // <-- ¡CORRECCIÓN AÑADIDA AQUÍ!
) {
    header('Location: login.php');
    exit;
}
// ==========================================================
// FIN: GUARDIÁN DE AUTENTICACIÓN
// ==========================================================

define('APP_ROOT', __DIR__);

// --- Configuración de la base de datos MySQL ---
define('DB_HOST', 'localhost'); // O la IP de tu servidor de MySQL
define('DB_NAME', 'lpr_db');     // Nombre de tu base de datos MySQL
define('DB_USER', 'root');     // Usuario de MySQL
define('DB_PASS', '');         // Contraseña de MySQL

// --- Configuración de la base de datos SQLite (comentada) ---
// Si decides usar SQLite en el futuro, puedes descomentar y configurar esto:
// define('DB_PATH', APP_ROOT . '/lpr_data.sqlite');

// Configuración de la zona horaria para PHP
date_default_timezone_set('America/Argentina/Buenos_Aires');

// --- Funciones de Seguridad (CSRF) ---
/**
 * Genera un token CSRF si no existe en la sesión, o devuelve el actual.
 * @return string El token CSRF.
 */
function generate_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        // Genera un token aleatorio seguro (32 bytes = 64 caracteres hexadecimales)
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Valida un token CSRF enviado en una petición POST (o GET si aplicara).
 * Usa hash_equals() para una comparación segura contra ataques de temporización.
 * @param string $token El token recibido de la petición (ej. $_POST['csrf_token']).
 * @return bool True si el token es válido, false en caso contrario.
 */
function validate_csrf_token($token) {
    // Verifica que el token exista en la petición, en la sesión y que coincidan de forma segura
    if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        return false;
    }
    return true;
}

// Otros parámetros de configuración pueden ir aquí.

?>