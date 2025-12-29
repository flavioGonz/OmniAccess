// includes/js/toast.js

// Asegura que el contenedor de toasts exista en el body
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
});

/**
 * Muestra una notificación toast.
 * @param {string} message - El mensaje principal del toast.
 * @param {string} [type='info'] - El tipo de toast ('success', 'error', 'info', 'warning').
 * @param {number} [duration=5000] - Duración en milisegundos.
 */
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    const titles = {
        success: 'Éxito',
        error: 'Error',
        info: 'Información',
        warning: 'Advertencia'
    };

    const icon = icons[type] || 'fa-info-circle';
    const title = titles[type] || 'Aviso';

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-message">
            <strong>${title}</strong>
            <span>${message}</span>
        </div>
        <button class="toast-close-btn">×</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('click', () => {
        // Aplica animación de salida al hacer clic
        toast.style.animation = 'fadeOut 0.5s forwards';
        // Elimina el elemento después de la animación
        setTimeout(() => toast.remove(), 500);
    });

    // Elimina el toast automáticamente después de la duración especificada
    // El -500ms es para que coincida con la animación CSS de fadeOut
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}