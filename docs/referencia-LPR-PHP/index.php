<?php
/**
 * index.php - Controlador Frontal (Versión Definitiva y Limpia)
 */

// 1. CONFIGURACIÓN INICIAL (SIN SALIDA HTML)
require_once __DIR__ . '/config.php';

$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die('<div style="font-family: sans-serif; padding: 2rem; border: 2px solid red; margin: 2rem; border-radius: 8px;"><h1>Error Crítico de Conexión</h1><p>No se pudo conectar a la base de datos.</p><p>Detalle: ' . htmlspecialchars($e->getMessage()) . '</p></div>');
}

// Generamos el token CSRF para que esté disponible globalmente
$csrf_token = generate_csrf_token();
$currentPage = $_GET['page'] ?? 'dashboard';

// Array de todas las páginas permitidas
$allowed_pages = [
    'dashboard' => 'dashboard2.php',
    'dashboard2' => 'dashboard2.php',
    'dashboard3' => 'dashboard3.php',
    'live_events' => 'live_console.html',
    'event_history' => 'event_history.php',
    'access_lists' => 'manage_access_lists.php',
    'manage_lots' => 'manage_lots.php',
    'manage_owners_vehicles' => 'manage_owners_vehicles.php',
    'manage_users' => 'manage_users.php',
    'dispositivos_lpr' => 'dispositivos_lpr.php',
    'importar_datos' => 'importar_datos.php',
    'logout' => 'logout.php',
    'log_viewer' => 'log_viewer.php'
];

// 2. BUFFER DE SALIDA
// Iniciamos un buffer. Esto "captura" toda la salida HTML que genere
// el script incluido, en lugar de enviarla directamente al navegador.
ob_start();

// Incluimos el archivo de la página solicitada.
// La lógica POST se ejecutará ahora. Si hay una redirección, el script morirá.
// Si no, el HTML de la página se guardará en el buffer.
if (array_key_exists($currentPage, $allowed_pages)) {
    include __DIR__ . '/' . $allowed_pages[$currentPage];
} else {
    include __DIR__ . '/dashboard.php'; // Fallback seguro
}

// Guardamos el contenido del buffer (el HTML de la página) en una variable.
$page_content = ob_get_clean();

// 3. RENDERIZADO DEL LAYOUT PRINCIPAL
// Ahora que toda la lógica ha terminado (y sabemos que no hubo redirección),
// podemos empezar a imprimir la página principal.
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ParkVision LPR System</title>
    
    <!-- Tus estilos CSS y scripts globales no cambian -->
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="includes/css/menu.css">
    <link rel="stylesheet" href="includes/css/modals.css">
    <link rel="stylesheet" href="includes/css/toast.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700&family=Roboto+Mono:wght@500&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="includes/js/toast.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
</head>
<body class="dark-theme" data-page-id="<?= htmlspecialchars($currentPage) ?>">

    <header>
        <!-- Tu header y nav no cambian -->
        <div class="container header-container">
            <a href="index.php?page=dashboard" class="logo-link"><img src="images/logo.png" alt="ParkVision Logo" class="logo-image"></a>
            <nav class="main-nav" id="main-nav">
                 <ul class="nav-list">
                    <li><a href="index.php?page=dashboard" class="nav-link <?php echo $currentPage === 'dashboard' ? 'active' : ''; ?>"><i class="fas fa-tachometer-alt"></i> Dashboard</a></li>
                    <li><a href="index.php?page=live_events" class="nav-link <?php echo $currentPage === 'live_events' ? 'active' : ''; ?>"><i class="fas fa-video"></i> Eventos en Vivo</a></li>
                    <li><a href="index.php?page=event_history" class="nav-link <?php echo $currentPage === 'event_history' ? 'active' : ''; ?>"><i class="fas fa-history"></i> Historial</a></li>
                    <li class="dropdown">
                        <a href="#" class="nav-link <?php echo in_array($currentPage, ['access_lists', 'manage_lots', 'manage_owners_vehicles']) ? 'active' : ''; ?>"><i class="fas fa-list-check"></i> Gestión de Listas <i class="fas fa-caret-down"></i></a>
                        <ul class="dropdown-content">
                            <li><a href="index.php?page=access_lists"><i class="fas fa-clipboard-list"></i> Listas de Acceso</a></li>
                            <li><a href="index.php?page=manage_lots"><i class="fas fa-parking"></i> Lotes</a></li>
                            <li><a href="index.php?page=manage_owners_vehicles"><i class="fas fa-car"></i> Propietarios y Vehículos</a></li>
                        </ul>
                    </li>
                    <li class="dropdown">
                        <a href="#" class="nav-link"><i class="fas fa-cog"></i> Configuración <i class="fas fa-caret-down"></i></a>
                        <ul class="dropdown-content">
                            <li><a href="index.php?page=manage_users"><i class="fas fa-users-cog"></i> Usuarios</a></li>
                            <li><a href="index.php?page=dispositivos_lpr"><i class="fas fa-video"></i> Dispositivos LPR</a></li>
                            <li><a href="index.php?page=importar_datos"><i class="fas fa-file-csv"></i> Importar Datos</a></li>
                            <li><a href="index.php?page=log_viewer"><i class="fas fa-file-alt"></i> Visor de Logs</a></li>
                            <hr class="dropdown-divider">
                            <li><a href="auth.php?action=logout"><i class="fas fa-sign-out-alt"></i> Salir</a></li>
                        </ul>
                    </li>
                </ul>
            </nav>
            <div class="header-controls">
                <div class="header-clock-display" id="header-clock"></div>
                <button class="hamburger-menu" id="hamburger-menu" aria-label="Abrir menú"><i class="fas fa-bars"></i></button>
            </div>
        </div>
    </header>
    <div class="nav-overlay" id="nav-overlay"></div>

    <main class="container">
        <?php
        // Imprimimos el contenido de la página que capturamos en el buffer.
        echo $page_content;
        ?>
    </main>

    <footer>
        <div class="container">
            <p>© <?php echo date("Y"); ?> ParkVision LPR System.</p>
        </div>
    </footer>
    
    <script src="includes/js/main.js"></script>
    <?php
        $page_script_path = 'includes/js/' . $currentPage . '.js';
        if (file_exists(__DIR__ . '/' . $page_script_path)) {
            echo '<script src="' . $page_script_path . '"></script>';
        }
    ?>
</body>
</html>