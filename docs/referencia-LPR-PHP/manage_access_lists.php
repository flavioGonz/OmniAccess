<?php
/**
 * manage_access_lists.php — Gestión de Listas (Detectadas = sin lista asignada + Toasts)
 *
 * Cambios pedidos:
 *  - Pestaña “Detectadas” = matrículas que NO tienen lista asignada (ni blanca, ni negra, ni proveedores).
 *      * Es decir: vehicles.list_type IS NULL o NOT IN ('whitelist','blacklist','supplier') o ''.
 *      * No incluye matrículas que solo existen en events (deben existir en vehicles).
 *  - Notificaciones: reemplazo de .message.success/.message.error por toasts.
 *  - Se mantiene: único buscador, “Última Captura”, Skeleton loaders, “Verificar” y “Sincronizar” en todas.
 */

echo '<link rel="stylesheet" href="includes/css/dashboard.css">';

global $pdo, $csrf_token;
require_once __DIR__ . '/api_helpers.php';

/* -------------------- CONTROLADOR (POST) -------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && validate_csrf_token($_POST['csrf_token'] ?? '')) {
    $action = $_POST['action'] ?? '';
    $success_messages = $_SESSION['success_messages'] ?? [];
    $error_messages   = $_SESSION['error_messages'] ?? [];

    /* Alta/Edición */
    if ($action === 'add_plate' || $action === 'edit_plate') {
        $plate     = strtoupper(trim(preg_replace('/[^A-Z0-9]/i', '', $_POST['plate'] ?? '')));
        $list_type = $_POST['list_type'] ?? 'whitelist';
        $owner_id  = empty($_POST['owner_id']) ? null : $_POST['owner_id'];
        $is_whitelisted = ($list_type === 'whitelist') ? 1 : 0;
        $vehicle_id = $_POST['vehicle_id'] ?? null;

        if (!empty($plate)) {
            try {
                if ($action === 'edit_plate' && !empty($vehicle_id)) {
                    $stmt = $pdo->prepare("UPDATE vehicles
                        SET plate = :plate, list_type = :list_type, is_whitelisted = :is_whitelisted,
                            owner_id = :owner_id, updated_at = NOW()
                        WHERE id = :id");
                    $stmt->execute([
                        ':plate'=>$plate, ':list_type'=>$list_type, ':is_whitelisted'=>$is_whitelisted,
                        ':owner_id'=>$owner_id, ':id'=>$vehicle_id
                    ]);
                    $success_messages[] = "Matrícula '{$plate}' actualizada correctamente.";
                } else {
                    $stmt = $pdo->prepare("INSERT INTO vehicles (plate, list_type, is_whitelisted, owner_id, created_at, updated_at)
                        VALUES (:plate, :list_type, :is_whitelisted, :owner_id, NOW(), NOW())
                        ON DUPLICATE KEY UPDATE list_type = :list_type, is_whitelisted = :is_whitelisted,
                                                owner_id = :owner_id, updated_at = NOW()");
                    $stmt->execute([
                        ':plate'=>$plate, ':list_type'=>$list_type, ':is_whitelisted'=>$is_whitelisted, ':owner_id'=>$owner_id
                    ]);
                    $success_messages[] = "Matrícula '{$plate}' guardada en la lista '{$list_type}'.";
                }
            } catch (PDOException $e) {
                $error_messages[] = "Error de base de datos: " . $e->getMessage();
            }
        } else {
            $error_messages[] = "La matrícula no puede estar vacía.";
        }
    }

    /* Eliminación */
    if ($action === 'delete_plate') {
        $vehicle_id = $_POST['vehicle_id_to_delete'] ?? '';
        if (!empty($vehicle_id)) {
            try {
                $stmt = $pdo->prepare("SELECT plate, list_type FROM vehicles WHERE id = :id");
                $stmt->execute([':id'=>$vehicle_id]);
                $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($vehicle) {
                    $plate_to_delete = $vehicle['plate'];

                    // Eliminar de cámaras sólo si existe el helper (evita fatal error)
                    if ($vehicle['list_type'] === 'whitelist' && function_exists('deletePlateFromCameraWhitelist')) {
                        $all_cameras = $pdo->query("SELECT id, name, ip, username, password FROM devices")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($all_cameras as $camera) {
                            @deletePlateFromCameraWhitelist($camera, $plate_to_delete);
                        }
                    }

                    $pdo->prepare("DELETE FROM vehicles WHERE id = :id")->execute([':id'=>$vehicle_id]);
                    $success_messages[] = "Matrícula '{$plate_to_delete}' eliminada de la base de datos local.";
                }
            } catch (PDOException $e) {
                $error_messages[] = "Error de base de datos al eliminar: " . $e->getMessage();
            }
        }
    }

    $_SESSION['success_messages'] = $success_messages;
    $_SESSION['error_messages']   = $error_messages;

    header('Location: ' . $_SERVER['REQUEST_URI']);
    exit();
}

/* -------------------- MENSAJES (se usarán como toasts) -------------------- */
$success_messages = $_SESSION['success_messages'] ?? [];
$error_messages   = $_SESSION['error_messages'] ?? [];
unset($_SESSION['success_messages'], $_SESSION['error_messages']);

/* -------------------- ENTRADA (GET) -------------------- */
$current_list = $_GET['list'] ?? 'whitelist'; // whitelist | blacklist | supplier | detected | all
$search_q     = trim($_GET['search'] ?? '');  // ÚNICO BUSCADOR

$items_per_page = 20;
$current_page = max(1, (int)($_GET['p'] ?? 1));

/* -------------------- SQL (según pestaña) -------------------- */
$params = [];
$offset = 0;
$total_records = 0;
$total_pages = 0;
$vehicles = [];

$owners_list = $pdo->query("SELECT id, name FROM owners ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
$is_filtered = ($search_q !== '');

/* Helpers WHERE */
function whereForList($current_list, &$params) {
    // Para pestañas por lista concreta
    $valid = ['whitelist','blacklist','supplier'];
    $where = [];
    if (in_array($current_list, $valid, true)) {
        $where[] = "v.list_type = :list_type";
        $params[':list_type'] = $current_list;
    }
    // "detected" se maneja por su propia condición más abajo
    return $where ? (" WHERE " . implode(" AND ", $where)) : "";
}

/* ---------- Todas la pestañas renderizan desde vehicles (según pedido de negocio) ---------- */
/* Select común (incluye última captura) */
$select_sql = "SELECT
    v.id,
    v.plate AS plate,
    v.list_type,
    v.created_at,
    v.owner_id,
    o.name AS owner_name,
    GROUP_CONCAT(DISTINCT l.description ORDER BY l.description SEPARATOR ', ') AS lot_descriptions,
    (SELECT MAX(e.timestamp) FROM events e WHERE e.plate = v.plate) AS last_capture";

$base_sql = " FROM vehicles v
    LEFT JOIN owners o ON v.owner_id = o.id
    LEFT JOIN owner_lot_associations ola ON o.id = ola.owner_id
    LEFT JOIN lots l ON ola.lot_id = l.id";

/* WHERE base por lista fija */
$where_parts = [];
$where_sql = whereForList($current_list, $params);
if ($where_sql) $where_parts[] = substr($where_sql, 7); // quitamos " WHERE " para poder combinar

/* Pestaña DETECTADAS = sin lista asignada */
if ($current_list === 'detected') {
    $where_parts[] = "(v.list_type IS NULL OR v.list_type NOT IN ('whitelist','blacklist','supplier') OR v.list_type = '')";
}

/* WHERE final */
$where_sql_final = $where_parts ? (" WHERE " . implode(" AND ", $where_parts)) : "";

/* Búsqueda: HAVING (usa alias plate/owner_name/lot_descriptions) */
$having_parts = [];
if ($search_q !== '') {
    $params[':search'] = "%".$search_q."%";
    $having_parts[] = "(plate LIKE :search OR owner_name LIKE :search OR lot_descriptions LIKE :search)";
}
$group_by = " GROUP BY v.id";
$having   = $having_parts ? (" HAVING " . implode(" AND ", $having_parts)) : "";

/* Conteo */
$count_sql = "SELECT COUNT(*) FROM (
    SELECT v.id, v.plate AS plate, o.name AS owner_name,
           GROUP_CONCAT(DISTINCT l.description ORDER BY l.description SEPARATOR ', ') AS lot_descriptions,
           (SELECT MAX(e.timestamp) FROM events e WHERE e.plate = v.plate) AS last_capture
    $base_sql
    $where_sql_final
    $group_by
    $having
) subq";
$st = $pdo->prepare($count_sql);
$st->execute($params);
$total_records = (int)$st->fetchColumn();
$total_pages   = $total_records > 0 ? (int)ceil($total_records / $items_per_page) : 0;
if ($current_page > $total_pages && $total_pages > 0) $current_page = $total_pages;
$offset = ($current_page - 1) * $items_per_page;

/* Datos */
$data_sql = "$select_sql $base_sql $where_sql_final $group_by $having ORDER BY v.created_at DESC LIMIT :lim OFFSET :off";
$st = $pdo->prepare($data_sql);
foreach ($params as $k=>&$v) $st->bindParam($k,$v);
$st->bindValue(':lim', $items_per_page, PDO::PARAM_INT);
$st->bindValue(':off', $offset, PDO::PARAM_INT);
$st->execute();
$vehicles = $st->fetchAll(PDO::FETCH_ASSOC);
?>
<style>
/* ---------- Tabs (pestañas) ---------- */
.tabs {
  display:flex; gap:6px;
  border-bottom:1px solid var(--border-color,#2f3640);
  margin:6px 0 14px 0;
}
.tabs a {
  display:inline-flex; align-items:center; gap:8px;
  padding:10px 14px; border:1px solid transparent; border-top-left-radius:10px; border-top-right-radius:10px;
  color:#cbd5e1; text-decoration:none; background:transparent; position:relative; top:1px;
}
.tabs a.active { background:#1f2937; border-color:#374151; color:#fff; font-weight:600; }
.tabs a:hover { background:#111827; color:#fff; }

/* ---------- Toolbar ---------- */
.filter-bar.widget { margin-bottom:12px; }
.filter-form { display:grid; grid-template-columns: 1fr auto auto; gap:12px; align-items:center; }
.filter-form .form-group { position:relative; }
.filter-form .form-group i { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9aa0a6; }
.filter-form input[type="text"] {
  width:85%; height:42px; padding:0 12px 0 34px;
  border-radius:8px; border:1px solid #3a3f46; background:#2b2f36; color:#e9edf1;
}
.filter-form .btn { height:42px; }
@media (max-width:900px){ .filter-form{ grid-template-columns:1fr; } }

/* ---------- Estado cámaras ---------- */
.sync-badge{ display:inline-block; padding:4px 8px; border-radius:999px; margin:2px; font-size:.85rem; border:1px solid transparent; }
.sync-badge.synced { background:rgba(22,163,74,.15); color:#16a34a; border-color:rgba(22,163,74,.35); }
.sync-badge.missing{ background:rgba(239,68,68,.15); color:#ef4444; border-color:rgba(239,68,68,.35); }
.sync-badge.offline{ background:rgba(148,163,184,.15); color:#94a3b8; border-color:rgba(148,163,184,.35); }
.badge.list-type-whitelist{ background:rgba(22,163,74,.15); color:#16a34a; }
.badge.list-type-blacklist{ background:rgba(239,68,68,.15); color:#ef4444; }
.badge.list-type-supplier{ background:rgba(148,163,184,.15); color:#e5e7eb; }

/* ---------- Owner cell ---------- */
.owner-cell small { display:block; color:#9aa0a6; margin-top:4px; }

/* ---------- Skeletons ---------- */
.skel-row { height:56px; }
.skel { position:relative; overflow:hidden; background:#1f2430; border-radius:8px; }
.skel::after {
  content:""; position:absolute; inset:0;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.08), rgba(255,255,255,0));
  transform: translateX(-100%); animation: shimmer 1.2s infinite;
}
@keyframes shimmer { 100% { transform: translateX(100%);} }
.skel-pill { width:110px; height:26px; border-radius:999px; }
.skel-text { height:16px; width:60%; border-radius:6px; }
.skel-plate{ width:140px; height:36px; border-radius:6px; }

/* ---------- Toasts ---------- */
.toast-container {
  position: fixed; top: 16px; right: 16px; z-index: 99999;
  display: flex; flex-direction: column; gap: 10px;
}
.toast {
  min-width: 280px; max-width: 420px;
  background: #111827; color: #e5e7eb; border: 1px solid #374151;
  border-radius: 10px; padding: 10px 12px; display: flex; gap: 10px; align-items: start;
  box-shadow: 0 10px 25px rgba(0,0,0,.35);
  animation: slideIn .25s ease-out;
}
.toast.success { border-color: rgba(22,163,74,.5); background: rgba(22,163,74,.12); }
.toast.error   { border-color: rgba(239,68,68,.5); background: rgba(239,68,68,.12); }
.toast .icon { font-size: 18px; line-height: 1; margin-top: 2px; }
.toast .msg  { flex: 1; }
.toast .close { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; }
@keyframes slideIn { from { opacity:0; transform: translateY(-6px);} to { opacity:1; transform:none;} }
</style>

<!-- TÍTULO -->
<h1>Gestión de Listas de Acceso</h1>

<!-- PESTAÑAS -->
<div class="tabs" id="listTabs">
  <a data-skel="1" href="?page=access_lists&list=whitelist" class="<?= $current_list == 'whitelist' ? 'active' : '' ?>">Lista Blanca</a>
  <a data-skel="1" href="?page=access_lists&list=blacklist"  class="<?= $current_list == 'blacklist'  ? 'active' : '' ?>">Lista Negra</a>
  <a data-skel="1" href="?page=access_lists&list=supplier"   class="<?= $current_list == 'supplier'   ? 'active' : '' ?>">Proveedores</a>
  <a data-skel="1" href="?page=access_lists&list=detected"   class="<?= $current_list == 'detected'   ? 'active' : '' ?>">Detectadas</a>
  <a data-skel="1" href="?page=access_lists&list=all"        class="<?= $current_list == 'all'        ? 'active' : '' ?>">Todos</a>
</div>

<!-- ÚNICO buscador -->
<div class="filter-bar widget">
  <form id="searchForm" action="index.php" method="GET" class="filter-form">
    <input type="hidden" name="page" value="access_lists">
    <input type="hidden" name="list" value="<?= htmlspecialchars($current_list) ?>">
    <div class="form-group">
      <i class="fas fa-search"></i>
      <input type="text" name="search" placeholder="Buscar por Matrícula, Propietario o Lote..." value="<?= htmlspecialchars($search_q) ?>" class="form-control">
    </div>
    <button type="submit" class="btn btn-primary">Buscar</button>
    <?php if ($is_filtered): ?>
      <a data-skel="1" href="index.php?page=access_lists&list=<?= urlencode($current_list) ?>" class="btn btn-secondary">Limpiar</a>
    <?php endif; ?>
  </form>
</div>

<section class="data-section">
  <table>
    <thead>
      <tr>
        <th>Matrícula</th>
        <th>Propietario / Lote</th>
        <th>Lista</th>
        <th>Última Captura</th>
        <th style="width: 28%;">Estado en Cámaras</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody id="tableBody">
      <?php if (empty($vehicles)): ?>
        <tr><td colspan="6" style="text-align:center; padding:2rem;">No se encontraron matrículas.</td></tr>
      <?php else: ?>
        <?php foreach ($vehicles as $v): ?>
          <tr
            data-vehicle-id="<?= (int)$v['id'] ?>"
            data-plate="<?= htmlspecialchars($v['plate']) ?>"
            data-list-type="<?= htmlspecialchars($v['list_type']) ?>"
            data-owner-id="<?= htmlspecialchars($v['owner_id'] ?? '') ?>"
          >
            <!-- Matrícula -->
            <td>
              <a href="#" class="plate-history-link" title="Ver historial de esta matrícula">
                <div class="styled-plate-mercosur">
                  <div class="plate-inner">
                    <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                    <div class="plate-number"><?= htmlspecialchars($v['plate']) ?></div>
                  </div>
                </div>
              </a>
            </td>

            <!-- Propietario / Lote -->
            <td class="owner-cell">
              <?= htmlspecialchars($v['owner_name'] ?? 'No Asignado') ?>
              <?php if (!empty($v['lot_descriptions'])): ?>
                <small>Lote: <?= htmlspecialchars($v['lot_descriptions']) ?></small>
              <?php endif; ?>
            </td>

            <!-- Lista -->
            <td>
              <?php if (!empty($v['list_type'])): ?>
                <span class="badge list-type-<?= htmlspecialchars($v['list_type']) ?>"><?= ucfirst(htmlspecialchars($v['list_type'])) ?></span>
              <?php else: ?>
                <span class="muted">—</span>
              <?php endif; ?>
            </td>

            <!-- Última captura -->
            <td>
              <?php
                $lc = $v['last_capture'] ?? null;
                if ($lc) {
                    try { $dt = new DateTime($lc); echo htmlspecialchars($dt->format('Y-m-d H:i:s')); }
                    catch (Exception $e) { echo htmlspecialchars($lc); }
                } else {
                    echo '<span class="muted">—</span>';
                }
              ?>
            </td>

            <!-- Estado en Cámaras -->
            <td class="camera-status-cell">
              <div class="status-container" data-plate="<?= htmlspecialchars($v['plate']) ?>">
                <button class="btn btn-secondary btn-sm check-status-btn"><i class="fas fa-search"></i> Verificar</button>
              </div>
            </td>

            <!-- Acciones -->
            <td>
              <button class="btn btn-secondary btn-sm edit-plate-btn"><i class="fas fa-edit"></i> Editar</button>
              <button class="btn btn-danger btn-sm open-delete-modal-btn"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
          </tr>
        <?php endforeach; ?>
      <?php endif; ?>
    </tbody>
  </table>

  <?php include __DIR__ . '/includes/pagination_controls.php'; ?>
</section>

<!-- MODALES -->
<div id="plateModal" class="modal">
  <div class="modal-content-wrapper">
    <form action="?page=access_lists&list=<?= urlencode($current_list) ?>" method="POST">
      <input type="hidden" name="action" id="plate_action" value="add_plate">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>">
      <input type="hidden" name="vehicle_id" id="vehicle_id">
      <div class="modal-header"><h2 id="plateModalTitle">Añadir Matrícula</h2><span class="close-button">×</span></div>
      <div class="modal-body">
        <div class="form-group"><label for="plate">Matrícula:</label><input type="text" id="plate" name="plate" class="form-control" required style="text-transform: uppercase;"></div>
        <div class="form-group"><label for="owner_id">Propietario (Opcional):</label>
          <select id="owner_id" name="owner_id" class="form-control">
            <option value="">-- Sin propietario --</option>
            <?php foreach ($owners_list as $owner) { echo '<option value="'.$owner['id'].'">'.htmlspecialchars($owner['name']).'</option>'; } ?>
          </select>
        </div>
        <div class="form-group"><label for="list_type">Tipo de Lista:</label>
          <select id="list_type" name="list_type" class="form-control">
            <option value="whitelist">Lista Blanca</option>
            <option value="blacklist">Lista Negra</option>
            <option value="supplier">Proveedores</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-button">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<div id="deletePlateModal" class="modal">
  <div class="modal-content-wrapper">
    <form action="?page=access_lists&list=<?= urlencode($current_list) ?>" method="POST">
      <input type="hidden" name="action" value="delete_plate">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token) ?>">
      <input type="hidden" name="vehicle_id_to_delete" id="vehicleIdToDeleteInput">
      <div class="modal-header"><h2>Confirmar Eliminación</h2><span class="close-button">×</span></div>
      <div class="modal-body">
        <p>¿Estás seguro que deseas eliminar la matrícula <strong id="plateToDeleteSpan" class="styled-plate-mercosur" style="display:inline-block;"></strong> de forma permanente?</p>
        <p class="message warning" style="margin-top:1rem;"><small>Esta acción también intentará eliminar la matrícula de TODAS las cámaras LPR configuradas (si hay soporte).</small></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-button">Cancelar</button>
        <button type="submit" class="btn btn-danger">Confirmar Eliminación</button>
      </div>
    </form>
  </div>
</div>

<div id="historyModal" class="modal">
  <div class="modal-content-wrapper">
    <div class="modal-header"><h2 id="historyModalTitle">Historial de Matrícula</h2><span class="close-button">×</span></div>
    <div class="modal-body" id="historyModalBody"><p>Cargando historial...</p></div>
    <div class="modal-footer"><button type="button" class="btn btn-secondary close-button">Cerrar</button></div>
  </div>
</div>

<div id="syncPlateModal" class="modal">
  <div class="modal-content-wrapper">
    <div class="modal-header"><h2>Sincronizar Matrícula</h2><span class="close-button">×</span></div>
    <div class="modal-body">
      <p>Seleccione las cámaras a las que desea enviar la matrícula <strong id="syncPlateLabel" class="styled-plate-mercosur" style="display:inline-block;"></strong>:</p>
      <form id="sync-plate-form">
        <input type="hidden" id="sync-plate-value" name="plate">
        <div id="sync-camera-list" class="camera-checkbox-group"></div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary close-button">Cancelar</button>
      <button type="button" id="confirm-sync-btn" class="btn btn-primary"><i class="fas fa-sync-alt"></i> Sincronizar Ahora</button>
    </div>
    <div id="sync-result-log" class="log-box" style="margin-top:1rem; display:none; height:150px;"></div>
  </div>
</div>

<!-- FAB -->
<div class="fab-container">
  <ul class="fab-options">
    <li><span class="fab-label">Añadir Matrícula</span>
      <button class="fab-secondary" id="openAddPlateModalBtn" title="Añadir nueva matrícula"><i class="fas fa-plus"></i></button>
    </li>
  </ul>
  <button class="fab-main" title="Añadir Matrícula"><i class="fas fa-plus"></i></button>
</div>

<!-- Contenedor de Toasts -->
<div class="toast-container" id="toastContainer"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  /* ---------- TOASTS ---------- */
  const toastContainer = document.getElementById('toastContainer');
  function showToast(type, msg, timeout=4000){
    if (!msg) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success' ? '✔' : (type === 'error' ? '✖' : 'ℹ');
    el.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="msg">${escapeHtml(msg)}</div>
      <button class="close" aria-label="Cerrar">×</button>`;
    toastContainer.appendChild(el);
    const closer = el.querySelector('.close');
    closer.addEventListener('click', ()=> { el.remove(); });
    setTimeout(()=> { el.remove(); }, timeout);
  }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

  /* Mostrar toasts desde PHP (mensajes de sesión) */
  const successMsgs = <?= json_encode($success_messages, JSON_UNESCAPED_UNICODE) ?>;
  const errorMsgs   = <?= json_encode($error_messages,   JSON_UNESCAPED_UNICODE) ?>;
  (successMsgs||[]).forEach(m => showToast('success', m));
  (errorMsgs||[]).forEach(m => showToast('error', m));

  /* ---------- Skeleton helpers ---------- */
  function makeSkeletonRow(){
    return `
      <tr class="skel-row">
        <td><div class="skel skel-plate"></div></td>
        <td><div class="skel skel-text" style="width:160px;margin-bottom:6px;"></div><div class="skel skel-text" style="width:120px;"></div></td>
        <td><div class="skel skel-pill"></div></td>
        <td><div class="skel skel-text" style="width:140px;"></div></td>
        <td><div class="skel skel-text" style="width:80%;"></div></td>
        <td><div class="skel skel-text" style="width:100px;"></div></td>
      </tr>`;
  }
  function showSkeleton(count=8){
    const tb = document.getElementById('tableBody');
    if (!tb) return;
    let html = '';
    for (let i=0;i<count;i++) html += makeSkeletonRow();
    tb.innerHTML = html;
  }

  /* Mostrar skeleton al buscar / cambiar de tabs / limpiar */
  const searchForm = document.getElementById('searchForm');
  searchForm.addEventListener('submit', function(){ showSkeleton(); });
  document.querySelectorAll('a[data-skel="1"]').forEach(a=>{
    a.addEventListener('click', function(){ showSkeleton(); });
  });

  /* FAB → abre modal de alta */
  const fabMain = document.querySelector('.fab-main');
  if (fabMain) fabMain.addEventListener('click', () => document.getElementById('openAddPlateModalBtn').click());

  const plateModal  = document.getElementById('plateModal');
  const deleteModal = document.getElementById('deletePlateModal');
  const historyModal= document.getElementById('historyModal');
  const syncModal   = document.getElementById('syncPlateModal');

  /* Abrir Alta */
  document.getElementById('openAddPlateModalBtn').addEventListener('click', () => {
    plateModal.querySelector('form').reset();
    plateModal.querySelector('#plateModalTitle').textContent = 'Añadir Matrícula';
    plateModal.querySelector('#plate_action').value = 'add_plate';
    plateModal.querySelector('#vehicle_id').value = '';
    plateModal.style.display = 'flex';
  });

  /* Delegación en filas de la tabla */
  document.querySelector('table tbody').addEventListener('click', async function(e) {
    const target = e.target;
    const button = target.closest('button');
    const historyLink = target.closest('.plate-history-link');
    const row = target.closest('tr');
    if (!row) return;

    /* Editar */
    if (button && button.classList.contains('edit-plate-btn')) {
      plateModal.querySelector('form').reset();
      plateModal.querySelector('#plate').value = row.dataset.plate;
      plateModal.querySelector('#plateModalTitle').textContent = 'Editar Matrícula';
      plateModal.querySelector('#plate_action').value = 'edit_plate';
      plateModal.querySelector('#vehicle_id').value = row.dataset.vehicleId;
      plateModal.querySelector('#list_type').value = row.dataset.listType || 'whitelist';
      plateModal.querySelector('#owner_id').value  = row.dataset.ownerId || '';
      plateModal.style.display = 'flex';
    }

    /* Eliminar */
    if (button && button.classList.contains('open-delete-modal-btn')) {
      if (!row.dataset.vehicleId) { showToast('error','No se puede eliminar: la matrícula no está registrada.'); return; }
      deleteModal.querySelector('#vehicleIdToDeleteInput').value = row.dataset.vehicleId;
      deleteModal.querySelector('#plateToDeleteSpan').innerHTML = `
        <div class="plate-inner">
          <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
          <div class="plate-number">${row.dataset.plate}</div>
        </div>`;
      deleteModal.style.display = 'flex';
    }

    /* Historial */
    if (historyLink) {
      e.preventDefault();
      const plate = row.dataset.plate;
      historyModal.querySelector('#historyModalTitle').innerHTML =
        `Historial de <div class="styled-plate-mercosur" style="display:inline-block; vertical-align:middle; transform:scale(.8); margin-left:10px;"><div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${plate}</div></div></div>`;
      const modalBody = historyModal.querySelector('#historyModalBody');
      modalBody.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Cargando historial...</p>';
      historyModal.style.display = 'flex';
      try {
        const resp = await fetch(`get_plate_history.php?plate=${encodeURIComponent(plate)}`);
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.message || 'Error de red');
        if (result.success && result.data.length > 0) {
          let html = '<table class="compact"><thead><tr><th>Fecha/Hora</th><th>Decisión</th><th>Cámara</th></tr></thead><tbody>';
          result.data.forEach(ev => {
            let cls = ev.decision && ev.decision.includes('permitido') ? 'decision-green' : 'decision-red';
            let deviceName = ev.device_name || 'Desconocida';
            let dt = new Date(ev.timestamp.replace(' ','T'));
            let formatted = dt.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
            html += `<tr><td>${formatted}</td><td><span class="badge ${cls}">${ev.decision||''}</span></td><td>${deviceName}</td></tr>`;
          });
          modalBody.innerHTML = html + '</tbody></table>';
        } else {
          modalBody.innerHTML = `<p>${result.success ? 'No se encontraron eventos.' : 'Error: ' + (result.message||'')}</p>`;
        }
      } catch (err) {
        console.error(err);
        modalBody.innerHTML = '<p class="message error">Error al cargar el historial.</p>';
      }
    }

    /* Verificar en cámaras + “Sincronizar” */
    if (button && button.classList.contains('check-status-btn')) {
      const container = button.parentElement;
      const plate = container.dataset.plate;
      container.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Comprobando...`;
      try {
        const resp = await fetch(`check_plate_on_cameras.php?plate=${encodeURIComponent(plate)}`);
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.message || 'Error de red');
        if (result.success) {
          let html = '', missing_cameras = [];
          (result.data||[]).forEach(cam => {
            let statusClass = 'offline', title = 'Cámara offline o no responde';
            if (cam.is_online) {
              if (cam.is_present) { statusClass = 'synced'; title = 'Matrícula presente'; }
              else { statusClass = 'missing'; title = 'Matrícula no encontrada'; missing_cameras.push(cam); }
            }
            html += `<span class="sync-badge ${statusClass}" title="${title}">${cam.camera_name}</span>`;
          });
          html += ` <button class="btn btn-secondary btn-sm sync-now-btn" data-plate="${plate}" data-missing='${JSON.stringify(missing_cameras)}'>Sincronizar</button>`;
          container.innerHTML = html;
        } else {
          container.innerHTML = `<span style="color:var(--decision-red);">Error</span> <button class="btn btn-secondary btn-sm check-status-btn">Reintentar</button>`;
        }
      } catch (err) {
        container.innerHTML = `<span style="color:var(--decision-red);">Error de red</span> <button class="btn btn-secondary btn-sm check-status-btn">Reintentar</button>`;
      }
    }

    /* Abrir sincronización */
    if (button && button.classList.contains('sync-now-btn')) {
      const plate = button.dataset.plate;
      const missingCameras = JSON.parse(button.dataset.missing || '[]');
      document.getElementById('syncPlateLabel').innerHTML =
        `<div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${plate}</div></div>`;
      document.getElementById('sync-plate-value').value = plate;

      let html = '<label class="checkbox-container select-all-label"><strong>Seleccionar Todas</strong><input type="checkbox" id="sync-select-all"><span class="checkmark"></span></label><hr>';
      missingCameras.forEach(cam => {
        if (cam.is_online) html += `<label class="checkbox-container">${cam.camera_name}<input type="checkbox" name="sync_cameras[]" value="${cam.camera_id}" checked><span class="checkmark"></span></label>`;
      });
      document.getElementById('sync-camera-list').innerHTML = html;
      const logBox = document.getElementById('sync-result-log');
      logBox.style.display='none'; logBox.innerHTML='';
      document.getElementById('syncPlateModal').style.display = 'flex';

      const sa = document.getElementById('sync-select-all');
      if (sa) sa.addEventListener('change', function(){
        document.querySelectorAll('#sync-plateModal input[name="sync_cameras[]"], #sync-plate-form input[name="sync_cameras[]"]').forEach(cb => cb.checked = this.checked);
      });
    }
  });

  /* Cerrar modales genéricos */
  document.querySelectorAll('.modal').forEach(modal => {
    modal.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', () => modal.style.display='none'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display='none'; });
  });

  /* Confirmar sincronización */
  const confirmSyncBtn = document.getElementById('confirm-sync-btn');
  if (confirmSyncBtn) {
    confirmSyncBtn.addEventListener('click', async function(){
      this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
      const log = document.getElementById('sync-result-log');
      log.style.display='block'; log.innerHTML='';
      const plate = document.getElementById('sync-plate-value').value;
      const selected = Array.from(document.querySelectorAll('input[name="sync_cameras[]"]:checked')).map(cb => cb.value);

      if ((selected||[]).length === 0) {
        log.appendChild(makeLog('Debe seleccionar al menos una cámara.','error'));
        this.disabled=false; this.innerHTML='<i class="fas fa-sync-alt"></i> Sincronizar Ahora'; return;
      }
      try{
        const resp = await fetch('process_camera_sync.php', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'add', plate, camera_ids:selected })
        });
        const result = await resp.json();
        if (result.success) {
          (result.details||[]).forEach(d => log.appendChild(makeLog(`[${d.camera_name}] ${d.message}`, d.success ? 'success':'error')));
          showToast('success','Sincronización finalizada');
        } else {
          log.appendChild(makeLog(`Error general: ${result.message||'desconocido'}`, 'error'));
          showToast('error','Falló la sincronización');
        }
      } catch(err){
        log.appendChild(makeLog('Error de red al sincronizar.','error'));
        showToast('error','Error de red al sincronizar');
      }
      this.disabled=false; this.innerHTML='<i class="fas fa-sync-alt"></i> Sincronizar Ahora';

      const statusContainer = document.querySelector(`.status-container[data-plate="${plate}"]`);
      if (statusContainer) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm check-status-btn';
        btn.innerHTML = '<i class="fas fa-search"></i> Verificar';
        statusContainer.innerHTML = ''; statusContainer.appendChild(btn); btn.click();
      }
    });
  }

  function makeLog(text, type){
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-times-circle'}"></i> ${escapeHtml(text)}`;
    return div;
  }
});
</script>
