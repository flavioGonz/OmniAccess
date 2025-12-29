// includes/js/main.js - Director de Orquesta de Scripts

// --- Lógica GLOBAL que se ejecuta inmediatamente ---
function initializeGlobalUI() {
    // Lógica del Reloj del Header
    const clockElement = document.getElementById('header-clock');
    if (clockElement) {
        function updateClock() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            clockElement.textContent = timeString;
        }
        setInterval(updateClock, 1000);
        updateClock();
    }

    // Lógica del Menú Responsivo
    const hamburgerBtn = document.getElementById('hamburger-menu');
    const mainNav = document.getElementById('main-nav');
    const navOverlay = document.getElementById('nav-overlay');
    const dropdowns = document.querySelectorAll('.main-nav .dropdown > a');

    if (hamburgerBtn && mainNav && navOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            mainNav.classList.toggle('is-open');
            navOverlay.classList.toggle('is-visible');
            document.body.classList.toggle('no-scroll');
        });
        navOverlay.addEventListener('click', () => {
            mainNav.classList.remove('is-open');
            navOverlay.classList.remove('is-visible');
            document.body.classList.remove('no-scroll');
        });
    }

    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', e => {
            if (window.innerWidth <= 1024) {
                e.preventDefault();
                dropdown.parentElement.classList.toggle('is-open');
            }
        });
    });
}

// --- Lógica de INICIALIZACIÓN que se ejecuta cuando el DOM está listo ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa la UI global (menú, reloj)
    initializeGlobalUI();

    // 2. Obtiene el ID de la página actual desde el body
    const currentPageId = document.body.dataset.pageId;

    // 3. Llama a la función de inicialización específica de la página, si existe
    if (currentPageId === 'dashboard' && typeof initDashboardPage === 'function') {
        initDashboardPage();
    } else if (currentPageId === 'manage_users' && typeof initManageUsersPage === 'function') {
        initManageUsersPage();
    }
    // ... puedes añadir más 'else if' para otras páginas con JS específico
});