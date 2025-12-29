<?php
// login.php (con CSS externo)
require_once __DIR__ . '/config.php';

// Si el usuario ya está logueado, redirigirlo al dashboard.
if (isset($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

$error = $_SESSION['login_error'] ?? null;
unset($_SESSION['login_error']);

$logout_message = $_SESSION['logout_message'] ?? null;
unset($_SESSION['logout_message']);

$csrf_token = generate_csrf_token();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión - ParkVision LPR</title>
    <!-- Cargamos el CSS principal para las variables de color y fuentes -->
    <link rel="stylesheet" href="style.css"> 
    <!-- Cargamos el CSS específico de la página de login -->
    <link rel="stylesheet" href="includes/css/login.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body class="dark-theme login-page">
    <div class="login-container">
        <div class="login-header">
            <img src="images/logo.png" alt="ParkVision Logo">
            <h1>Iniciar Sesión</h1>
        </div>

        <?php if ($logout_message): ?>
            <div class="login-success"><?= htmlspecialchars($logout_message) ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="login-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <form action="auth.php" method="POST">
            <input type="hidden" name="action" value="login">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>">
            
            <div class="form-group">
                <label for="username">Usuario</label>
                <input type="text" id="username" name="username" class="form-input" required autofocus>
            </div>
            
            <div class="form-group">
                <label for="password">Contraseña</label>
                <input type="password" id="password" name="password" class="form-input" required>
            </div>
            
            <button type="submit" class="btn btn-primary login-btn">Ingresar</button>
        </form>
    </div>
</body>
</html>