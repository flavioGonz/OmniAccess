<?php
/**
 * dashboard3.php - Timeline Horizontal de Actividad en Vivo
 */
global $pdo;
?>

<link rel="stylesheet" href="includes/css/dashboard.css">
<style>
    /* Estilos específicos para el Dashboard de Timeline Horizontal */
    .kpi-header {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 1.5rem;
    }
    
    .horizontal-timeline-container {
        width: 100%;
        overflow-x: auto; /* Permite scroll horizontal */
        padding: 2rem 0;
        -webkit-overflow-scrolling: touch; /* Scroll suave en móviles */
        scrollbar-width: thin;
        scrollbar-color: var(--primary-yellow) var(--surface-color);
        background-color: var(--background-color); /* Fondo oscuro para la barra */
        border-top: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
    }
    .horizontal-timeline-container::-webkit-scrollbar { height: 8px; }
    .horizontal-timeline-container::-webkit-scrollbar-thumb { background-color: var(--primary-yellow); border-radius: 4px; }

    .timeline-wrapper {
        display: inline-flex; /* Hace que los elementos se pongan en línea y no se rompan */
        align-items: flex-start;
        padding: 0 2rem; /* Espacio en los extremos */
    }
    .timeline-item-h {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        margin: 0 1rem;
        flex-shrink: 0; /* Evita que las tarjetas se encojan */
    }
    /* La línea horizontal que conecta los puntos */
    .timeline-item-h::after {
        content: '';
        position: absolute;
        top: 22px; /* A la mitad del icono */
        right: -50%;
        width: 100%;
        height: 4px;
        background: var(--surface-color);
        z-index: 0;
    }
    .timeline-wrapper .timeline-item-h:last-child::after {
        display: none; /* No mostrar línea después del último elemento */
    }
    .timeline-icon-h {
        width: 44px; height: 44px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.2rem; color: white;
        border: 4px solid var(--background-color);
        z-index: 1; /* Por encima de la línea */
    }
    .timeline-icon-h.entry { background-color: var(--decision-green); }
    .timeline-icon-h.exit { background-color: var(--decision-red); }

    .timeline-content-h {
        width: 300px;
        margin-top: 1rem;
        background-color: var(--surface-color);
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        animation: capture-fade-in 0.6s ease-out;
    }
    .timeline-content-h:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    }
    .timeline-image-h { width: 100%; height: 150px; object-fit: cover; display: block; }
    .timeline-details-h { padding: 1rem; }
    .timeline-time-h { font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 0.5rem; }
    .timeline-owner { font-size: 0.9em; color: var(--secondary-text-color); margin-top: 0.25rem; }

    /* Estilos para el Popup de Detalles (se mantienen) */
    .details-popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000; display: none; align-items: center; justify-content: center; }
    .details-popup { width: 90%; max-width: 900px; height: 80vh; max-height: 600px; background: var(--surface-color); border-radius: var(--border-radius); border: 1px solid var(--border-color); box-shadow: 0 8px 30px rgba(0,0,0,0.5); display: grid; grid-template-columns: 400px 1fr; animation: capture-fade-in 0.3s ease-out; }
    .popup-left-column { padding: 1.5rem; display: flex; flex-direction: column; overflow-y: auto; }
    .popup-right-column { background-color: #1a1a1a; border-radius: 0 var(--border-radius) var(--border-radius) 0; }
    #popup-map { width: 100%; height: 100%; }
    .popup-header { text-align: center; }
    .popup-main-image { width: 100%; height: auto; max-height: 200px; object-fit: cover; border-radius: var(--border-radius); margin-top: 1rem; }
    .popup-details-table { width: 100%; margin-top: 1.5rem; font-size: 0.9em; }
    .popup-details-table td { padding: 8px 0; border-bottom: 1px solid var(--border-color); }
    .popup-details-table td:first-child { color: var(--secondary-text-color); width: 100px; }
    .popup-history { margin-top: 1.5rem; }
    .popup-history h4 { margin-bottom: 0.5rem; }
    .popup-history-list { list-style: none; padding-left: 1rem; border-left: 2px solid var(--border-color); }
    .popup-history-item { position: relative; padding: 5px 0 15px 15px; }
    .popup-history-item::before { content: ''; position: absolute; left: -9px; top: 10px; width: 12px; height: 12px; border-radius: 50%; background: var(--secondary-text-color); border: 2px solid var(--surface-color); }
    .popup-history-item.entry::before { background: var(--decision-green); }
    .popup-history-item.exit::before { background: var(--decision-red); }
</style>

<div class="command-dashboard">
    <div class="kpi-header">
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-entries"><i class="fas fa-arrow-right"></i></div><div><div class="value" id="kpi-entries">0</div><div class="label">Entradas Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-exits"><i class="fas fa-arrow-left"></i></div><div><div class="value" id="kpi-exits">0</div><div class="label">Salidas Hoy</div></div></div></div>
    </div>

    <div class="widget" style="grid-column: 1 / -1;">
        <div class="widget-header"><h3 class="widget-title"><i class="fas fa-stream"></i> Línea de Tiempo de Actividad</h3></div>
        <div class="horizontal-timeline-container" id="timeline-container">
            <div class="timeline-wrapper" id="timeline-feed">
                <p style="text-align: center; padding: 3rem; color: var(--secondary-text-color);">Cargando actividad...</p>
            </div>
        </div>
    </div>
</div>

<div class="details-popup-overlay" id="details-popup">
    <div class="details-popup">
        <div class="popup-left-column" id="popup-left-column">
            <div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>
        </div>
        <div class="popup-right-column">
            <div id="popup-map"></div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
    let lastEventId = 0;
    const detailsPopup = document.getElementById('details-popup');
    const popupLeftColumn = document.getElementById('popup-left-column');
    let popupMap = null;

    async function updateDashboard() {
        try {
            const response = await fetch('get_dashboard_timeline.php');
            if (!response.ok) return;
            const result = await response.json();
            if (!result.success) return;

            const data = result.data;

            document.getElementById('kpi-entries').textContent = data.kpis.entries_today;
            document.getElementById('kpi-exits').textContent = data.kpis.exits_today;

            const timelineFeed = document.getElementById('timeline-feed');
            if (data.timeline_events.length > 0) {
                if (lastEventId !== 0 && data.timeline_events[0].id > lastEventId) {
                    notifyNewEvent(data.timeline_events[0]);
                }
                lastEventId = data.timeline_events[0].id;
                
                let timelineHtml = '';
                data.timeline_events.forEach(event => {
                    const isEntry = event.device_purpose === 'entry';
                    const iconClass = isEntry ? 'fa-arrow-right' : 'fa-arrow-left';
                    const iconType = isEntry ? 'entry' : 'exit';
                    const decisionClass = event.decision.includes('permitido') ? 'permitido' : 'denegado';
                    const imageUrl = event.image_path ? `/LPR/${event.image_path}` : 'images/placeholder.jpg';

                    timelineHtml += `
                        <div class="timeline-item-h" data-event-id="${event.id}">
                            <div class="timeline-icon-h ${iconType}"><i class="fas ${iconClass}"></i></div>
                            <div class="timeline-content-h">
                                <img src="${imageUrl}" alt="Captura de ${event.plate}" class="timeline-image-h">
                                <div class="timeline-details-h">
                                    <div class="timeline-time-h">${new Date(event.timestamp).toLocaleString('es-AR')}</div>
                                    <div class="styled-plate-mercosur">
                                        <div class="plate-inner">
                                            <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                                            <div class="plate-number">${event.plate}</div>
                                        </div>
                                    </div>
                                    <div class="timeline-owner">${event.owner_name || 'No Asignado'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                timelineFeed.innerHTML = timelineHtml;
            } else {
                 timelineFeed.innerHTML = '<p style="text-align: center; padding: 3rem; color: var(--secondary-text-color);">No hay eventos recientes.</p>';
            }
        } catch (error) {
            console.error("Error al actualizar el dashboard:", error);
        }
    }

    function notifyNewEvent(event) {
        let type = 'info';
        if (event.decision === 'acceso_denegado') type = 'error';
        if (event.list_type === 'blacklist') type = 'error';
        if (event.list_type === 'whitelist' && event.decision === 'acceso_permitido') type = 'success';
        
        let message = `<b>${event.device_purpose === 'entry' ? 'Entrada Detectada' : 'Salida Detectada'}</b><span class="toast-plate">${event.plate}</span>`;
        if (event.list_type === 'blacklist') {
            message = `<b>¡ALERTA LISTA NEGRA!</b><span class="toast-plate">${event.plate}</span>`;
        }
        showToast(message, type, 8000);
    }

    document.getElementById('timeline-feed').addEventListener('click', function(e) {
        const item = e.target.closest('.timeline-item-h');
        if (item && item.dataset.eventId) {
            openDetailsPopup(item.dataset.eventId);
        }
    });

    async function openDetailsPopup(eventId) {
        detailsPopup.style.display = 'flex';
        popupLeftColumn.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Cargando detalles...</p></div>';
        if (popupMap) { popupMap.remove(); popupMap = null; }
        document.getElementById('popup-map').innerHTML = '';
        
        try {
            const response = await fetch(`get_event_details.php?id=${eventId}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const data = result.data;
            renderPopupContent(data);
            setTimeout(() => initializePopupMap(data), 100);
        } catch (error) {
            popupLeftColumn.innerHTML = `<p class="message error">Error al cargar los detalles: ${error.message}</p>`;
        }
    }

    function renderPopupContent(data) {
        const details = data.details;
        const history = data.history;
        const imageUrl = details.image_path ? `/LPR/${details.image_path}` : 'images/placeholder.jpg';
        let historyHtml = '';
        history.forEach(item => {
            historyHtml += `<li class="popup-history-item ${item.purpose}"><div class="history-item-content"><strong>${item.purpose === 'entry' ? 'Entrada' : 'Salida'}</strong> en ${item.device_name || 'N/A'}<div class="history-item-time">${new Date(item.timestamp).toLocaleString('es-AR')}</div></div></li>`;
        });
        popupLeftColumn.innerHTML = `
            <div class="popup-header"><div class="styled-plate-mercosur"><div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${details.plate}</div></div></div></div>
            <img src="${imageUrl}" alt="Captura" class="popup-main-image">
            <table class="popup-details-table">
                <tr><td>Propietario:</td><td><strong>${details.owner_name || 'No Asignado'}</strong></td></tr>
                <tr><td>Lote:</td><td><strong>${details.lot_description || 'N/A'}</strong></td></tr>
                <tr><td>Decisión:</td><td><span class="badge ${details.decision.includes('permitido') ? 'list-type-whitelist' : 'list-type-blacklist'}">${details.decision.replace(/_/g, ' ')}</span></td></tr>
                <tr><td>Fecha:</td><td>${new Date(details.timestamp).toLocaleString('es-AR')}</td></tr>
            </table>
            <div class="popup-history"><h4>Historial Reciente</h4><ul class="popup-history-list">${historyHtml}</ul></div>`;
    }

    function initializePopupMap(data) {
        popupMap = L.map('popup-map').setView([-34.907, -54.838], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(popupMap);

        if (data.details.lot_latitude && data.details.lot_longitude) {
            const lotLatLng = [data.details.lot_latitude, data.details.lot_longitude];
            popupMap.setView(lotLatLng, 18);
            L.marker(lotLatLng).addTo(popupMap).bindTooltip(`<b>Lote: ${data.details.lot_description}</b><br>${data.details.owner_name}`).openTooltip();
        } else if (data.map_fallback_locations) {
            const bounds = [];
            data.map_fallback_locations.forEach(cam => {
                const camLatLng = [cam.latitude, cam.longitude];
                bounds.push(camLatLng);
                const iconColor = cam.purpose === 'entry' ? 'green' : 'red';
                L.circleMarker(camLatLng, {radius: 8, color: iconColor, fillOpacity: 0.8}).addTo(popupMap).bindTooltip(cam.name);
            });
            if (bounds.length > 0) popupMap.fitBounds(bounds, {padding: [50, 50]});
        }
    }
    
    detailsPopup.addEventListener('click', (e) => {
        if (e.target === detailsPopup) {
            detailsPopup.style.display = 'none';
        }
    });

    updateDashboard();
    setInterval(updateDashboard, 3000);
});
</script>