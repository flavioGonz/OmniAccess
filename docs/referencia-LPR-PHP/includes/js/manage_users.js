// includes/js/manage_users.js - Módulo de la Página de Gestión de Usuarios

function initManageUsersPage() {
    console.log('Inicializando scripts de Gestión de Usuarios...');

    const userModal = document.getElementById('user-modal');
    if (!userModal) return;

    // --- LÓGICA DEL MODAL AÑADIR/EDITAR ---
    const modalTitle = document.getElementById('modal-title');
    const userForm = document.getElementById('user-form');
    // ... (resto de las constantes: userIdInput, usernameInput, etc.)
    
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            // ... tu lógica para abrir el modal de añadir ...
            userModal.style.display = 'flex';
        });
    }

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // ... tu lógica para abrir el modal de editar ...
            userModal.style.display = 'flex';
        });
    });

    // --- LÓGICA DEL MODAL DE BORRADO ---
    const deleteModal = document.getElementById('delete-modal');
    // ... (resto de tu lógica para el modal de borrado)

    // --- LÓGICA DE CIERRE DE MODALES ---
    document.querySelectorAll('#manage-users-container .modal .close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}