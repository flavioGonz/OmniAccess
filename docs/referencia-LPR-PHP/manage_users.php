<?php
/**
 * manage_users.php (Versión Final con JS y CSS externos)
 */

echo '<link rel="stylesheet" href="includes/css/manage_users.css">';

$message = '';
$error_messages = [];
$csrf_token = generate_csrf_token();

if (isset($_SESSION['message'])) {
    $message = $_SESSION['message'];
    unset($_SESSION['message']);
}
if (isset($_SESSION['error_messages'])) {
    $error_messages = $_SESSION['error_messages'];
    unset($_SESSION['error_messages']);
}

$users = $pdo->query("SELECT id, username, created_at FROM users ORDER BY username ASC")->fetchAll(PDO::FETCH_ASSOC);

// Lógica para mostrar toasts
if ($message) {
    echo "<script>document.addEventListener('DOMContentLoaded', () => { showToast('" . addslashes($message) . "', 'success'); });</script>";
}
if (!empty($error_messages)) {
    foreach ($error_messages as $error) {
        echo "<script>document.addEventListener('DOMContentLoaded', () => { showToast('" . addslashes($error) . "', 'error'); });</script>";
    }
}
?>

<!-- Contenedor principal para esta página específica -->
<div id="manage-users-container">
    <h1>Gestión de Usuarios</h1>

    <section class="data-section">
        <h2>Usuarios del Sistema</h2>
        <?php if (!empty($users)): ?>
            <table>
                <thead>
                    <tr>
                        <th>Nombre de Usuario</th>
                        <th>Fecha Creación</th>
                        <th style="text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $user): ?>
                        <tr>
                            <td><i class="fas fa-user" style="margin-right: 0.5rem; color: var(--secondary-text-color);"></i> <?= htmlspecialchars($user['username']) ?></td>
                            <td><?= (new DateTime($user['created_at']))->format('d/m/Y H:i') ?></td>
                            <td style="text-align: right;">
                                <button class="btn btn-secondary edit-btn" data-id="<?= $user['id'] ?>" data-username="<?= htmlspecialchars($user['username']) ?>">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <?php if ($user['id'] != $_SESSION['user_id']): ?>
                                <button class="btn btn-danger delete-btn" data-id="<?= $user['id'] ?>" data-username="<?= htmlspecialchars($user['username']) ?>">
                                    <i class="fas fa-trash-alt"></i> Eliminar
                                </button>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="message info">No hay usuarios registrados.</p>
        <?php endif; ?>
    </section>

    <!-- MODAL PARA AÑADIR/EDITAR USUARIO -->
    <div id="user-modal" class="modal">
        <div class="modal-content">
            <form id="user-form" action="index.php?page=manage_users" method="POST">
                <input type="hidden" name="action" value="add_edit_user">
                <input type="hidden" id="user-id" name="id">
                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>">
                <div class="modal-header"><h2 id="modal-title"></h2><span class="close-btn">×</span></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="username">Nombre de Usuario:</label>
                        <input type="text" id="username" name="username" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Contraseña:</label>
                        <input type="password" id="password" name="password" class="form-input" autocomplete="new-password">
                        <small id="password-help" class="form-text">Dejar en blanco para no cambiar.</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-btn">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL DE CONFIRMACIÓN DE BORRADO -->
    <div id="delete-modal" class="modal">
        <div class="modal-content">
            <form action="index.php?page=manage_users" method="POST">
                <input type="hidden" name="action" value="delete_user">
                <input type="hidden" id="delete-user-id" name="id">
                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>">
                <div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-btn">×</span></div>
                <div class="modal-body">
                    <p>¿Seguro que quieres eliminar al usuario "<strong id="delete-username"></strong>"?</p>
                    <p class="message warning">Esta acción no se puede deshacer.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-btn">Cancelar</button>
                    <button type="submit" class="btn btn-danger">Sí, Eliminar</button>
                </div>
            </form>
        </div>
    </div>

    <!-- BOTÓN FLOTANTE (FAB) PARA AÑADIR USUARIO -->
    <div class="fab-container">
        <button class="fab-main" id="add-user-btn" title="Añadir Nuevo Usuario"><i class="fas fa-plus"></i></button>
    </div>

</div> <!-- Fin del #manage-users-container -->

