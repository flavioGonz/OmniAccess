<?php
/**
 * dashboard2.php - Centro de Comando Geoespacial (v23.3 - Navegación en Popup y KPIs Mejorados)
 */
global $pdo;

echo '<link rel="stylesheet" href="includes/css/dashboard.css">';

// --- Las consultas PHP ahora solo cargan los datos iniciales para el mapa ---
$devices_on_map_query = $pdo->query("SELECT id, name, purpose, latitude, longitude FROM devices WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
$devices_on_map = $devices_on_map_query->fetchAll(PDO::FETCH_ASSOC);

$all_devices_query = $pdo->query("SELECT id, name FROM devices");
$all_devices = $all_devices_query->fetchAll(PDO::FETCH_ASSOC);
?>

<style>
    /* Estilos para el nuevo Dashboard Geoespacial con Timelines Verticales */
    .kpi-header {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
    }
    .kpi-widget .value { font-size: 1.6rem; }
    .kpi-widget .label { font-size: 0.7rem; }
    .command-dashboard { grid-template-rows: auto 1fr; }
    .feed-column { display: flex; flex-direction: column; }
    .widget.feed-widget { flex-grow: 1; display: flex; flex-direction: column; }
    .widget-content.timeline-widget-content { flex-grow: 1; padding: 0 1rem; overflow-y: auto; }
    .vertical-timeline { position: relative; padding: 1.5rem 0; }
    .vertical-timeline::before { content: ''; position: absolute; top: 0; left: 6px; height: 100%; width: 4px; background: var(--surface-color); border-radius: 2px; }
    .timeline-v-item { position: relative; margin-bottom: 1.5rem; padding-left: 25px; opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .timeline-v-item.visible { opacity: 1; transform: translateY(0); }
    .timeline-v-item:last-child { margin-bottom: 0; }
    .timeline-v-item::before { content: ''; position: absolute; left: 0; top: 10px; width: 12px; height: 12px; border-radius: 50%; border: 3px solid var(--background-color); z-index: 1; background-color: var(--secondary-text-color); }
    .timeline-v-content { position: relative; border-radius: var(--border-radius); overflow: hidden; height: 120px; background-size: cover; background-position: center; cursor: pointer; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-left: 5px solid var(--secondary-text-color); transition: transform 0.2s, box-shadow 0.2s, border-color 0.3s ease; }
    .timeline-v-content:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
    .timeline-v-content.decision-permitido { border-left-color: var(--decision-green); }
    .timeline-v-content.decision-denegado { border-left-color: var(--decision-red); }
    .timeline-v-overlay { width: 100%; padding: 0.75rem; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, transparent 100%); color: #fff; }
    .timeline-v-info { display: flex; justify-content: space-between; align-items: center; }
    .timeline-v-owner { font-size: 0.8em; opacity: 0.8; margin-top: 2px; }
    .timeline-v-time { font-size: 0.8em; font-family: 'Roboto Mono', monospace; }
    .details-popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
    .details-popup { width: 90%; max-width: 1000px; height: 80vh; max-height: 550px; background: var(--surface-color); border-radius: var(--border-radius); border: 1px solid var(--border-color); box-shadow: 0 8px 30px rgba(0,0,0,0.5); display: grid; grid-template-columns: 1fr 1fr; animation: capture-fade-in 0.3s ease-out; position: relative; /* Añadido para posicionar las flechas */ }
    .popup-left-column { position: relative; background-size: cover; background-position: center; border-radius: var(--border-radius) 0 0 var(--border-radius); display: flex; flex-direction: column; justify-content: flex-end; color: white; padding: 0; }
    .popup-left-column::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to top, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.5) 60%, transparent 100%); border-radius: var(--border-radius) 0 0 var(--border-radius); }
    .popup-overlay-content { position: relative; z-index: 2; padding: 1.5rem; }
    .popup-overlay-content .styled-plate-mercosur { transform: scale(1.2); transform-origin: left; margin-bottom: 1rem; }
    .popup-overlay-content h3 { font-size: 2.2rem; margin: 0 0 0.5rem 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); font-weight: 700; line-height: 1.2; }
    .popup-overlay-content p { margin: 0.25rem 0; font-size: 1rem; color: #e0e0e0; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); }
    .popup-overlay-content p i { width: 20px; }
    .popup-decision-badge { display: inline-flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; padding: 0.75rem 1.5rem; border-radius: 50px; font-size: 1.1rem; font-weight: bold; color: white; text-transform: uppercase; }
    .popup-decision-badge.permitido { background-color: var(--decision-green); box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4); }
    .popup-decision-badge.denegado { background-color: var(--decision-red); box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4); }
    .popup-right-column { background-color: #1a1a1a; border-radius: 0 var(--border-radius) var(--border-radius) 0; }
    #popup-map { width: 100%; height: 100%; }

    /* Estilos para las imágenes de fondo de los KPIs y las flechas del popup */
    .kpi-widget { position: relative; overflow: hidden; background-size: cover; background-position: center; transition: transform 0.3s ease; }
    .kpi-widget:hover { transform: scale(1.05); }
    .kpi-widget .kpi-content { position: relative; z-index: 2; background: rgba(0,0,0,0.5); padding: 1rem; height: 100%; border-radius: var(--border-radius); }
    .kpi-header .kpi-widget:nth-child(1) { background-image: url('images/widget-kpi-1.png'); }
    .kpi-header .kpi-widget:nth-child(2) { background-image: url('images/widget-kpi-2.png'); }
    .kpi-header .kpi-widget:nth-child(3) { background-image: url('images/widget-kpi-3.png'); }
    .kpi-header .kpi-widget:nth-child(4) { background-image: url('images/widget-kpi-4.png'); }
    .kpi-header .kpi-widget:nth-child(5) { background-image: url('images/widget-kpi-5.png'); }
    .kpi-header .kpi-widget:nth-child(6) { background-image: url('images/widget-kpi-6.png'); }
    .kpi-header .kpi-widget:nth-child(7) { background-image: url('images/widget-kpi-7.png'); }
    .popup-nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); background-color: rgba(0, 0, 0, 0.5); color: white; border: none; width: 40px; height: 60px; font-size: 1.5rem; cursor: pointer; z-index: 2010; transition: background-color 0.2s; }
    .popup-nav-arrow:hover { background-color: rgba(0, 0, 0, 0.8); }
    .popup-nav-arrow:disabled { background-color: rgba(0, 0, 0, 0.2); color: #888; cursor: not-allowed; }
    .popup-nav-arrow.prev { left: 0; border-radius: 0 8px 8px 0; }
    .popup-nav-arrow.next { right: 0; border-radius: 8px 0 0 8px; }
</style>

<div class="command-dashboard">
    <div class="kpi-header">
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-entries"><i class="fas fa-arrow-right"></i></div><div><div class="value" id="kpi-entries">0</div><div class="label">Entradas Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-exits"><i class="fas fa-arrow-left"></i></div><div><div class="value" id="kpi-exits">0</div><div class="label">Salidas Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-denied"><i class="fas fa-ban"></i></div><div><div class="value" id="kpi-denied">0</div><div class="label">Denegados Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-gates"><i class="fas fa-truck"></i></div><div><div class="value" id="kpi-suppliers">0</div><div class="label">Proveedores Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-exits"><i class="fas fa-star"></i></div><div><div class="value" id="kpi-top-vehicle">-</div><div class="label">Vehículo Más Activo</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-entries"><i class="fas fa-camera"></i></div><div><div class="value" id="kpi-total-captures">0</div><div class="label">Capturas Totales Hoy</div></div></div></div>
        <div class="widget kpi-widget"><div class="kpi-content"><div class="icon icon-gates"><i class="fas fa-hourglass-half"></i></div><div><div class="value" id="kpi-time-since-capture">00:00</div><div class="label">Tiempo sin Captura</div></div></div></div>
    </div>
    
    <div class="feed-column" id="entry-feed-column"><div class="widget feed-widget"><div class="widget-header"><h3 class="widget-title"><i class="fas fa-sign-in-alt"></i> Timeline de Entradas</h3></div><div class="widget-content timeline-widget-content"><div class="vertical-timeline" id="entry-timeline-feed"></div></div></div></div>
    <div class="map-main-area"><div id="dashboard-map"></div></div>
    <div class="feed-column" id="exit-feed-column"><div class="widget feed-widget"><div class="widget-header"><h3 class="widget-title"><i class="fas fa-sign-out-alt"></i> Timeline de Salidas</h3></div><div class="widget-content timeline-widget-content"><div class="vertical-timeline" id="exit-timeline-feed"></div></div></div></div>
</div>

<div class="details-popup-overlay" id="details-popup">
    <div class="details-popup">
        <div class="popup-left-column" id="popup-left-column"></div>
        <div class="popup-right-column"><div id="popup-map"></div></div>
        <button class="popup-nav-arrow prev" id="popup-prev-event" title="Evento Anterior"><i class="fas fa-chevron-left"></i></button>
        <button class="popup-nav-arrow next" id="popup-next-event" title="Evento Siguiente"><i class="fas fa-chevron-right"></i></button>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/intersection-observer@0.12.2/intersection-observer.js"></script>
<script>
    const devicesOnMap = <?= json_encode($devices_on_map) ?>;
    const allDevicesForMapping = <?= json_encode($all_devices) ?>;
</script>
<script src="includes/js/dashboard.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
    let lastEventId = 0;
    const detailsPopup = document.getElementById('details-popup');
    const popupLeftColumn = document.getElementById('popup-left-column');
    let popupMap = null;
    let notificationTimeout;

    let lastCaptureTimestamp = Date.now();
    let timeSinceCaptureInterval;
    let recentEventsCache = [];
    let currentPopupIndex = -1;

    const prevBtn = document.getElementById('popup-prev-event');
    const nextBtn = document.getElementById('popup-next-event');

    const kpiValues = {
        entries: document.getElementById('kpi-entries'),
        exits: document.getElementById('kpi-exits'),
        denied: document.getElementById('kpi-denied'),
        suppliers: document.getElementById('kpi-suppliers'),
        topVehicle: document.getElementById('kpi-top-vehicle'),
        totalCaptures: document.getElementById('kpi-total-captures'),
        timeSinceCapture: document.getElementById('kpi-time-since-capture'),
    };

    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const contentDiv = entry.target;
                contentDiv.style.backgroundImage = `url('${contentDiv.dataset.src}')`;
                observer.unobserve(contentDiv);
            }
        });
    }, { rootMargin: "200px" });

    function renderVerticalTimeline(container, events, type) {
        if (!container) return;
        const existingIds = new Set(Array.from(container.children).map(child => child.dataset.eventId));
        const newEvents = events.filter(event => !existingIds.has(String(event.id)));
        if (events.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding: 2rem; color: var(--secondary-text-color);">No hay ${type === 'entry' ? 'entradas' : 'salidas'} recientes.</p>`;
            return;
        }
        if (newEvents.length > 0) {
            let newHtml = '';
            newEvents.forEach(event => {
                const imageUrl = event.image_path ? `/LPR/${event.image_path}` : 'images/placeholder.jpg';
                const decisionClass = event.decision.includes('permitido') ? 'decision-permitido' : 'decision-denegado';
                newHtml += `
                    <div class="timeline-v-item" data-event-id="${event.id}">
                        <div class="timeline-v-content ${decisionClass}" data-src="${imageUrl}">
                            <div class="timeline-v-overlay">
                                <div class="timeline-v-info">
                                    <div class="styled-plate-mercosur-small">${event.plate}</div>
                                    <div class="timeline-v-time">${new Date(event.timestamp).toLocaleTimeString('es-AR')}</div>
                                </div>
                                <div class="timeline-v-owner">${event.owner_name || 'No Asignado'}</div>
                            </div>
                        </div>
                    </div>`;
            });
            container.insertAdjacentHTML('afterbegin', newHtml);
        }
        while (container.children.length > 10) { container.removeChild(container.lastChild); }
        container.querySelectorAll('.timeline-v-content[data-src]').forEach(div => {
            if (!div.style.backgroundImage) lazyLoadObserver.observe(div);
        });
        setTimeout(() => {
            container.querySelectorAll('.timeline-v-item:not(.visible)').forEach(item => item.classList.add('visible'));
        }, 50);
    }
    
    async function updateDashboard() {
        try {
            const response = await fetch('get_main_dashboard_data.php');
            const result = await response.json();
            if (!result.success) return;
            const data = result.data;
            
            kpiValues.entries.textContent = data.kpis.entries_today;
            kpiValues.exits.textContent = data.kpis.exits_today;
            kpiValues.denied.textContent = data.kpis.denied_today;
            kpiValues.suppliers.textContent = data.kpis.suppliers_today;
            const topVehicle = data.kpis.top_vehicle;
            kpiValues.topVehicle.innerHTML = `${topVehicle.plate} <span style="font-size:0.7em;">(${topVehicle.count})</span>`;
            kpiValues.totalCaptures.textContent = parseInt(data.kpis.entries_today) + parseInt(data.kpis.exits_today);

            const allLatestEvents = [...data.latest_entries, ...data.latest_exits].sort((a, b) => b.id - a.id);
            recentEventsCache = allLatestEvents.slice(0, 10);

            if (allLatestEvents.length > 0 && allLatestEvents[0].id > lastEventId) {
                lastEventId = allLatestEvents[0].id;
                openDetailsPopup(allLatestEvents[0].id, true);
                lastCaptureTimestamp = Date.now();
                if (!timeSinceCaptureInterval) { startTimeSinceCaptureTimer(); }
            }
            
            renderVerticalTimeline(document.getElementById('entry-timeline-feed'), data.latest_entries, 'entry');
            renderVerticalTimeline(document.getElementById('exit-timeline-feed'), data.latest_exits, 'exit');

        } catch (error) { console.error("Error al actualizar dashboard:", error); }
    }

    function startTimeSinceCaptureTimer() {
        if(timeSinceCaptureInterval) clearInterval(timeSinceCaptureInterval);
        timeSinceCaptureInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - lastCaptureTimestamp) / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            kpiValues.timeSinceCapture.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        }, 1000);
    }
    
    async function openDetailsPopup(eventId, isNotification = false) {
        if (isNotification) {
            if (notificationTimeout) clearTimeout(notificationTimeout);
            currentPopupIndex = recentEventsCache.findIndex(e => e.id == eventId);
        }

        updateNavButtons();
        detailsPopup.style.display = 'flex';
        popupLeftColumn.innerHTML = '<div style="text-align:center; padding: 2rem; color: white;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        popupLeftColumn.style.backgroundImage = 'none';
        if (popupMap) { popupMap.remove(); popupMap = null; }
        document.getElementById('popup-map').innerHTML = '';
        
        try {
            const response = await fetch(`get_event_details.php?id=${eventId}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            renderPopupContent(result.data);
            setTimeout(() => initializePopupMap(result.data), 100);

            if (isNotification) {
                notificationTimeout = setTimeout(() => {
                    detailsPopup.style.display = 'none';
                }, 60000);
            }
        } catch (error) {
            popupLeftColumn.innerHTML = `<div style="padding: 1.5rem;"><p class="message error">Error al cargar los detalles: ${error.message}</p></div>`;
        }
    }

    function updateNavButtons(){
        if(currentPopupIndex === -1 || recentEventsCache.length <= 1){
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        } else {
            prevBtn.disabled = currentPopupIndex === 0;
            nextBtn.disabled = currentPopupIndex === recentEventsCache.length - 1;
        }
    }

    prevBtn.addEventListener('click', () => {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (currentPopupIndex > 0) {
            currentPopupIndex--;
            openDetailsPopup(recentEventsCache[currentPopupIndex].id, false);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (currentPopupIndex < recentEventsCache.length - 1) {
            currentPopupIndex++;
            openDetailsPopup(recentEventsCache[currentPopupIndex].id, false);
        }
    });
    
    document.querySelector('.command-dashboard').addEventListener('click', function(e) {
        const item = e.target.closest('.timeline-v-item');
        if (item && item.dataset.eventId) {
            currentPopupIndex = recentEventsCache.findIndex(event => event.id == item.dataset.eventId);
            if(currentPopupIndex !== -1){
                openDetailsPopup(item.dataset.eventId, false);
            }
        }
    });

    function renderPopupContent(data) {
        const details = data.details;
        const imageUrl = details.image_path ? `/LPR/${details.image_path}` : 'images/placeholder.jpg';
        popupLeftColumn.style.backgroundImage = `url('${imageUrl}')`;
        const isPermitido = details.decision.includes('permitido');
        const decisionClass = isPermitido ? 'permitido' : 'denegado';
        const decisionIcon = isPermitido ? 'fa-check-circle' : 'fa-ban';

        popupLeftColumn.innerHTML = `
            <div class="popup-overlay-content">
                <div class="styled-plate-mercosur" style="transform: scale(1.2); transform-origin: left; margin-bottom: 1rem;">
                    <div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span></div><div class="plate-number">${details.plate}</div></div>
                </div>
                <h3>${details.owner_name || 'Vehículo No Identificado'}</h3>
                <p><i class="fas fa-id-card fa-fw"></i> Lote: <strong>${details.lot_description || 'N/A'}</strong></p>
                <p><i class="far fa-clock fa-fw"></i> Hora: <strong>${new Date(details.timestamp).toLocaleString('es-AR')}</strong></p>
                <div class="popup-decision-badge ${decisionClass}"><i class="fas ${decisionIcon}"></i><span>${details.decision.replace(/_/g, ' ')}</span></div>
            </div>`;
    }

    function initializePopupMap(data) {
        if (!L) { console.error("Leaflet no está cargado."); return; }
        popupMap = L.map('popup-map', { zoomControl: false }).setView([-34.907, -54.838], 16);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
            attribution: '&copy; CartoDB',
            subdomains: 'abcd'
        }).addTo(popupMap);

        if (data.details.lot_latitude && data.details.lot_longitude) {
            const lotLatLng = [data.details.lot_latitude, data.details.lot_longitude];
            popupMap.setView(lotLatLng, 18);
            L.marker(lotLatLng).addTo(popupMap).bindTooltip(`<b>Lote: ${data.details.lot_description}</b><br>${data.details.owner_name}`).openTooltip();
        } else if (data.map_fallback_locations && data.map_fallback_locations.length > 0) {
            const bounds = [];
            data.map_fallback_locations.forEach(cam => {
                if(cam.latitude && cam.longitude){
                    const camLatLng = [cam.latitude, cam.longitude];
                    bounds.push(camLatLng);
                    const iconColor = cam.purpose === 'entry' ? 'green' : 'red';
                    L.circleMarker(camLatLng, {radius: 8, color: iconColor, fillOpacity: 0.8}).addTo(popupMap).bindTooltip(cam.name);
                }
            });
            if (bounds.length > 0) popupMap.fitBounds(bounds, {padding: [50, 50]});
        }
    }
    
    detailsPopup.addEventListener('click', (e) => {
        if (e.target === detailsPopup) {
            if (notificationTimeout) clearTimeout(notificationTimeout);
            detailsPopup.style.display = 'none';
        }
    });

    updateDashboard();
    setInterval(updateDashboard, 5000);
    startTimeSinceCaptureTimer();
});
</script>