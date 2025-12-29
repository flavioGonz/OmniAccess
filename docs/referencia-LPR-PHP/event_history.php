<?php
/**
 * event_history.php — Historial (V2 alineado + export simple)
 * - Filtro horizontal: fechas (desde/hasta) + buscador global + acciones alineadas
 * - Paginación (100 por defecto). Selector "Por página" abajo a la derecha.
 * - Miniatura clickeable -> modal redondeado con overlay (matrícula/fecha/propietario)
 * - Export CSV con modal simple: sólo por FECHA (todo/período) y por MATRÍCULA (opcional)
 * - Sin FAB y sin navbar propio. Respeta menú/estilos del app shell.
 */

date_default_timezone_set('America/Argentina/Buenos_Aires');

/* ---------- Tablas y columnas ---------- */
$tableEvents   = 'events';
$tableVehicles = 'vehicles';
$tableOwners   = 'owners';
$tableDevices  = 'devices';
$tableLots     = 'lots';
$tableOLA      = 'owner_lot_associations';

$E = [
  'id'        => 'id',
  'ts'        => 'timestamp',
  'plate'     => 'plate',
  'img'       => 'image_path',
  'decision'  => 'decision',
  'device_id' => 'device_id',
  'vehicle_id'=> 'vehicle_id',
];

/* ---------- Entrada ---------- */
$q              = trim($_GET['q'] ?? '');
$date_from      = trim($_GET['date_from'] ?? '');
$date_to        = trim($_GET['date_to'] ?? '');
$items_per_page = isset($_GET['perPage']) ? max(10, min(500, (int)$_GET['perPage'])) : 100; // default 100
$current_page   = isset($_GET['p']) && is_numeric($_GET['p']) ? max(1,(int)$_GET['p']) : 1;
$doExport       = isset($_GET['export']) && $_GET['export'] === '1';

/* filtros de export (simple: rango + matrícula opcional) */
$ex_scope = $_GET['ex_scope'] ?? 'all';  // all|period
$ex_from  = trim($_GET['ex_from'] ?? '');
$ex_to    = trim($_GET['ex_to']   ?? '');
$ex_plate = trim($_GET['ex_plate'] ?? '');

/* ---------- Helpers ---------- */
function e($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function detectColumn(PDO $pdo, string $table, array $cands){
  $st = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?");
  $st->execute([DB_NAME, $table]);
  $cols = array_map('strtolower', array_column($st->fetchAll(), 'COLUMN_NAME'));
  foreach($cands as $c){ if(in_array(strtolower($c), $cols, true)) return $c; }
  return null;
}
$deviceNameCol  = detectColumn($pdo, $tableDevices,  ['name','device_name','label','alias','title']) ?: 'name';
$ownerNameCol   = detectColumn($pdo, $tableOwners,   ['name','full_name','owner_name']) ?: 'name';

function buildBaseJoin($E,$tableEvents,$tableVehicles,$tableOwners,$tableDevices,$tableOLA,$tableLots){
  return "FROM `$tableEvents` e
          LEFT JOIN `$tableVehicles` v ON (v.id = e.`{$E['vehicle_id']}` OR v.`{$E['plate']}` = e.`{$E['plate']}`)
          LEFT JOIN `$tableOwners`   o ON o.id = v.owner_id
          LEFT JOIN `$tableDevices`  d ON d.id = e.`{$E['device_id']}`
          LEFT JOIN `$tableOLA`     ola ON o.id = ola.owner_id
          LEFT JOIN `$tableLots`      l ON ola.lot_id = l.id";
}

/* Búsqueda global: cada palabra se busca en plate/owner/device/lot/decision */
function buildSearchHaving(string $q){
  if ($q==='') return ['',[]];
  $terms = preg_split('/\s+/', $q);
  $havingParts = []; $binds = []; $i=0;
  foreach ($terms as $t){
    if ($t==='') continue; $i++; $k=":t$i"; $binds[$k] = "%$t%";
    $havingParts[] = "(plate LIKE $k OR owner_name LIKE $k OR device_name LIKE $k OR lot_description LIKE $k OR REPLACE(decision,'_',' ') LIKE $k)";
  }
  return [' HAVING '.implode(' AND ', $havingParts), $binds];
}

/* ---------- SQL base (detalle por evento) ---------- */
$joinBase = buildBaseJoin($E,$tableEvents,$tableVehicles,$tableOwners,$tableDevices,$tableOLA,$tableLots);

$selectCommon = "SELECT
  e.`{$E['id']}`   AS id,
  e.`{$E['ts']}`   AS timestamp,
  e.`{$E['plate']}` AS plate,
  e.`{$E['img']}`   AS image_path,
  e.`{$E['decision']}` AS decision,
  d.`$deviceNameCol` AS device_name,
  o.`$ownerNameCol`  AS owner_name,
  GROUP_CONCAT(DISTINCT l.description SEPARATOR ', ') AS lot_description";

/* WHERE por fechas */
$where = []; $wparams = [];
if ($date_from!==''){ $where[] = "e.`{$E['ts']}` >= :d1"; $wparams[':d1'] = $date_from.' 00:00:00'; }
if ($date_to  !==''){ $where[] = "e.`{$E['ts']}` <= :d2"; $wparams[':d2'] = $date_to.' 23:59:59'; }
$whereSQL = $where ? (' WHERE '.implode(' AND ', $where)) : '';

/* HAVING por búsqueda */
list($havingSearch, $searchBinds) = buildSearchHaving($q);

/* ---------- COUNT para paginación ---------- */
$countSQL = "SELECT COUNT(*) c FROM (
  $selectCommon
  $joinBase
  $whereSQL
  GROUP BY e.`{$E['id']}`
  $havingSearch
) t";
$st = $pdo->prepare($countSQL);
foreach ($wparams as $k=>$v) $st->bindValue($k,$v);
foreach ($searchBinds as $k=>$v) $st->bindValue($k,$v);
$st->execute();
$total_records = (int)$st->fetchColumn();
$total_pages   = max(1, (int)ceil($total_records / $items_per_page));
if ($current_page > $total_pages) $current_page = $total_pages;
$offset = ($current_page-1) * $items_per_page;

/* ---------- DATA page ---------- */
$dataSQL = "$selectCommon
  $joinBase
  $whereSQL
  GROUP BY e.`{$E['id']}`
  $havingSearch
  ORDER BY e.`{$E['ts']}` DESC
  LIMIT :lim OFFSET :off";
$st = $pdo->prepare($dataSQL);
foreach ($wparams as $k=>$v) $st->bindValue($k,$v);
foreach ($searchBinds as $k=>&$v) $st->bindParam($k,$v);
$st->bindValue(':lim',$items_per_page,PDO::PARAM_INT);
$st->bindValue(':off',$offset,PDO::PARAM_INT);
$st->execute();
$events = $st->fetchAll();

/* ---------- EXPORT CSV (simple) ---------- */
if ($doExport) {
  $whereEx = []; $wpEx = [];
  if ($ex_scope==='period'){
    if ($ex_from!==''){ $whereEx[]="e.`{$E['ts']}` >= :ex_from"; $wpEx[':ex_from']=$ex_from.' 00:00:00'; }
    if ($ex_to  !==''){ $whereEx[]="e.`{$E['ts']}` <= :ex_to";   $wpEx[':ex_to']=$ex_to.' 23:59:59'; }
  }
  $whereExSQL = $whereEx ? (' WHERE '.implode(' AND ', $whereEx)) : '';

  $havingEx = []; $hpEx = [];
  if ($ex_plate!==''){ $havingEx[]="plate LIKE :ex_plate"; $hpEx[':ex_plate']="%$ex_plate%"; }
  $havingExSQL = $havingEx ? (' HAVING '.implode(' AND ', $havingEx)) : '';

  $exportSQL = "$selectCommon
    $joinBase
    $whereExSQL
    GROUP BY e.`{$E['id']}`
    $havingExSQL
    ORDER BY e.`{$E['ts']}` DESC";
  $st = $pdo->prepare($exportSQL);
  foreach ($wpEx as $k=>$v) $st->bindValue($k,$v);
  foreach ($hpEx as $k=>$v) $st->bindValue($k,$v);
  $st->execute();
  $rows = $st->fetchAll();

  header('Content-Type: text/csv; charset=UTF-8');
  header('Content-Disposition: attachment; filename="historial_export.csv"');
  $out=fopen('php://output','w');
  // BOM para Excel
  fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
  $sep=';';

  fputs($out, "id{$sep}fecha{$sep}matricula{$sep}propietario{$sep}lote{$sep}camara{$sep}decision{$sep}imagen\n");

  foreach($rows as $r){
    $line=[ $r['id'],$r['timestamp'],$r['plate'],$r['owner_name'],$r['lot_description'],$r['device_name'],$r['decision'],$r['image_path'] ];
    // Limpia saltos de línea y separadores dentro de las celdas
    $clean = array_map(function($v) use ($sep){
      return str_replace(["\n","\r",$sep], [' ',' ','‚'], (string)$v);
    }, $line);
    fputs($out, implode($sep, $clean)."\n");
  }
  fclose($out); exit;
}

/* ---------- URL Paginación ---------- */
$baseQ = $_GET; $baseQ['page']='event_history'; unset($baseQ['p']); // p se agrega al final
$baseUrl = 'index.php?'.http_build_query($baseQ).'&p=';

$is_filtered = ($q!=='' || $date_from!=='' || $date_to!=='');
?>
<style>
  /* ====== Barra de filtros (3 columnas: fechas | buscador | acciones) ====== */
  .eh-filterbar{
    display: grid;
    grid-template-columns: auto minmax(340px,1fr) auto;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
  }
  /* Evita que los hijos del grid desborden y se monten unos sobre otros */
  .eh-filterbar > * { min-width: 0; }

  /* Fechas */
  .eh-dates{
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .eh-label{
    display: inline-flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #cfcfcf;
  }

  /* Inputs de fecha (tema oscuro, focus ring) */
  .eh-dates input[type="date"]{
    height: 42px;
    min-width: 170px;
    padding: 0 10px;
    border: 1px solid #3a3f46;
    border-radius: 8px;
    background: #2b2f36;
    color: #e9edf1;
    letter-spacing: .2px;
    transition: border-color .15s, box-shadow .15s;
  }
  .eh-dates input[type="date"]:focus{
    outline: none;
    border-color: #f4c542;
    box-shadow: 0 0 0 3px rgba(244,197,66,.15);
  }
  .eh-dates input[type="date"]::-webkit-calendar-picker-indicator{
    filter: invert(1) opacity(.85);
    cursor: pointer;
  }
  @-moz-document url-prefix(){
    .eh-dates input[type="date"]{ color-scheme: dark; }
  }

  /* Buscador centrado (con ícono) */
  .eh-search{ position: relative; width: 85%; min-width: 240px; margin-top: 3%;}
  .eh-search i{
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%); font-size: 14px; color: #9aa0a6; pointer-events: none;
  }
  .eh-input-lg{
    width: 100%;
    height: 42px;
    padding: 0 14px 0 36px;       /* espacio para el ícono */
    font-size: 1.05rem;
    border-radius: 8px;
    border: 1px solid #3a3f46;
    background: #2b2f36;
    color: #e9edf1;
    transition: border-color .15s, box-shadow .15s;
  }
  .eh-input-lg::placeholder{ color:#9aa0a6; }
  .eh-input-lg:focus{
    outline: none;
    border-color: #f4c542;
    box-shadow: 0 0 0 3px rgba(244,197,66,.15);
  }

  /* Acciones (alineadas, sin montarse sobre el buscador) */
  .eh-actions{
    display: flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;     /* evita que se partan en 2 líneas y tapen el buscador */
    justify-self: end;
  }
  .eh-total{ opacity: .85; }

  /* Botones: altura consistente con inputs (42px) */
  .btn{ height: 42px; padding: 0 16px; border-radius: 8px; border: 1px solid transparent; font-weight: 700; letter-spacing:.2px; cursor: pointer; }
  .btn-primary{ background:#ffc107; color:#1b1e23; border-color:#e0ad06; }
  .btn-primary:hover{ filter:brightness(.95); }
  .btn-secondary{ background:transparent; color:#e9edf1; border-color:#5a626b; border:1px solid #5a626b; }
  .btn-secondary:hover{ background:#2b2f36; }

  /* ====== Responsive ====== */
  @media (max-width: 1100px){
    .eh-filterbar{
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .eh-actions{ justify-self: start; }
  }
  @media (max-width: 520px){
    .eh-dates{ flex-direction: column; align-items: stretch; }
    .eh-dates input[type="date"]{ width: 100%; }
  }

  /* ====== Resto de estilos locales ====== */
  .plate-capture-thumb { width: 140px; height:auto; object-fit: cover; border-radius: var(--border-radius,10px); border: 1px solid var(--border-color,#3a3a3a); cursor:pointer; }

  .pagination-container { display:flex; justify-content:space-between; align-items:center; margin-top: 1.5rem; padding: .5rem 0; gap: 1rem; border-top: 1px solid var(--border-color); flex-wrap:wrap; }
  .pagination-links { display:flex; gap:.5rem; flex-wrap:wrap; }
  .pagination-links a, .pagination-links span { padding:.5rem .8rem; border:1px solid var(--border-color); border-radius: var(--border-radius); text-decoration:none; }
  .pagination-links .active { background: var(--primary-color,#ffc107); color:#111; border-color: var(--primary-color,#ffc107); font-weight:600; }
  .pagination-links .disabled { color: var(--disabled-color,#777); background: var(--background-color,#222); border-color: var(--disabled-color,#444); cursor:not-allowed; }
  .eh-perpage { margin-left:auto; display:flex; align-items:center; gap:.5rem; }

  /* Modal foto redondeado con overlay */
  .pv-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:9999}
  .pv-backdrop.show{display:flex}
  .pv-modal{position:relative;max-width:92vw;max-height:88vh;border-radius:16px;overflow:hidden;background:#000}
  .pv-modal img{display:block;max-width:92vw;max-height:88vh;width:auto;height:auto}
  .pv-meta{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;color:#fff;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,0));display:flex;gap:8px;flex-wrap:wrap;font-size:14px}
  .pv-pill{background:rgba(255,255,255,.15);backdrop-filter:blur(2px);border-radius:999px;padding:4px 8px}
  .pv-close{position:absolute;top:10px;right:10px;background:#fff;border:none;border-radius:999px;padding:8px 10px;cursor:pointer}
  .decision-green-text { color:#16a34a; }
  .decision-red-text   { color:#ef4444; }
  .decision-neutral-text{ color:#a1a1aa; }
</style>

<h1>HISTORIAL (V2)</h1>

<form action="index.php" method="get" class="card eh-filterbar">
  <input type="hidden" name="page" value="event_history">

  <!-- Fechas -->
  <div class="eh-dates">
    <label class="eh-label">Desde
      <input type="date" name="date_from" value="<?= e($date_from) ?>" class="form-control">
    </label>
    <label class="eh-label">Hasta
      <input type="date" name="date_to" value="<?= e($date_to) ?>" class="form-control">
    </label>
  </div>

  <!-- Buscador ancho -->
  <div class="eh-search">
    <i class="fas fa-search"></i>
    <input type="text" name="q" value="<?= e($q) ?>" class="eh-input-lg" placeholder="Buscar por matrícula, propietario, lote, cámara, decisión…">
  </div>

  <!-- Acciones -->
  <div class="eh-actions">
    <button class="btn btn-primary" type="submit">Aplicar</button>
    <a class="btn btn-secondary" href="index.php?page=event_history">Limpiar</a>
    <button type="button" class="btn btn-secondary" id="open-export-modal">Exportar CSV</button>
    <span class="muted eh-total">Total: <strong><?= (int)$total_records ?></strong><?= $is_filtered ? ' (filtros aplicados)' : '' ?></span>
  </div>
</form>

<section class="data-section">
  <table>
    <thead>
      <tr>
        <th>Fecha y Hora</th><th>Matrícula</th><th>Propietario</th><th>Lote</th><th>Cámara</th><th>Decisión</th><th>Captura</th>
      </tr>
    </thead>
    <tbody>
      <?php if (empty($events)): ?>
        <tr><td colspan="7" style="text-align:center; padding:2rem;">No se encontraron eventos. <?= $is_filtered ? 'Cambie o limpie los filtros.' : '' ?></td></tr>
      <?php else: foreach ($events as $ev):
        $file = trim((string)($ev['image_path'] ?? ''));
        $full_image_path = $file ? '/LPR/' . ltrim($file,'/') : '';
        $fs_path = $file ? APP_ROOT . '/' . $file : '';
        $show_img = ($file && is_file($fs_path));
        $dec = strtolower((string)$ev['decision']);
        $cls = (strpos($dec,'permit')!==false) ? 'decision-green-text' : ((strpos($dec,'deneg')!==false)?'decision-red-text':'decision-neutral-text');
      ?>
        <tr>
          <td><?= e($ev['timestamp']) ?></td>
          <td><span class="styled-plate"><?= e($ev['plate']) ?></span></td>
          <td><?= e($ev['owner_name'] ?? 'N/A') ?></td>
          <td><?= e($ev['lot_description'] ?? 'N/A') ?></td>
          <td><?= e($ev['device_name'] ?? 'N/A') ?></td>
          <td><span class="<?= $cls ?>"><?= e(ucwords(str_replace('_',' ', $ev['decision']))) ?></span></td>
          <td>
            <?php if ($show_img): ?>
              <img
                src="<?= e($full_image_path) ?>"
                class="plate-capture-thumb js-photo"
                alt="Captura de matrícula"
                data-plate="<?= e($ev['plate']) ?>"
                data-datetime="<?= e($ev['timestamp']) ?>"
                data-owner="<?= e($ev['owner_name'] ?? '—') ?>"
              >
            <?php else: ?>N/A<?php endif; ?>
          </td>
        </tr>
      <?php endforeach; endif; ?>
    </tbody>
  </table>

  <?php if ($total_pages > 1): ?>
    <div class="pagination-container">
      <div class="pagination-info muted">
        Página <strong><?= $current_page ?></strong> de <strong><?= $total_pages ?></strong> (<?= $total_records ?> resultados)
      </div>

      <nav class="pagination-links">
        <?php
          echo $current_page>1 ? '<a href="'.$baseUrl.($current_page-1).'">« Anterior</a>' : '<span class="disabled">« Anterior</span>';
          $window=1; $start=max(1,$current_page-$window); $end=min($total_pages,$current_page+$window);
          if ($start>1){ echo '<a href="'.$baseUrl.'1">1</a>'.($start>2?'<span class="dots">...</span>':''); }
          for($i=$start;$i<=$end;$i++){ echo '<a href="'.$baseUrl.$i.'" class="'.($i==$current_page?'active':'').'">'.$i.'</a>'; }
          if ($end<$total_pages){ echo ($end<$total_pages-1?'<span class="dots">...</span>':'').'<a href="'.$baseUrl.$total_pages.'">'.$total_pages.'</a>'; }
          echo $current_page<$total_pages ? '<a href="'.$baseUrl.($current_page+1).'">Siguiente »</a>' : '<span class="disabled">Siguiente »</span>';
        ?>
      </nav>

      <!-- Por página (abajo a la derecha) -->
      <form method="get" class="eh-perpage">
        <input type="hidden" name="page" value="event_history">
        <input type="hidden" name="q" value="<?= e($q) ?>">
        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
        <label class="muted">Por página</label>
        <select name="perPage" class="form-control" onchange="this.form.submit()">
          <?php foreach ([50,100,200,500] as $pp): ?>
            <option value="<?= $pp ?>" <?= $pp==$items_per_page ? 'selected' : '' ?>><?= $pp ?></option>
          <?php endforeach; ?>
        </select>
      </form>
    </div>
  <?php endif; ?>
</section>

<!-- MODAL EXPORT (simple) -->
<div id="export-modal" class="modal" style="display:none;">
  <div class="modal-content-wrapper">
    <form action="index.php" method="get">
      <input type="hidden" name="page" value="event_history">
      <input type="hidden" name="export" value="1">
      <div class="modal-header">
        <h2>Exportar CSV</h2>
        <span class="close-button">×</span>
      </div>
      <div class="modal-body">
        <div class="filter-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          <div class="form-group" style="grid-column:1/4;">
            <label>Rango</label>
            <div class="form-control" style="background:transparent;border:none;padding:0">
              <label style="margin-right:12px;"><input type="radio" name="ex_scope" value="all" checked> Todo</label>
              <label><input type="radio" name="ex_scope" value="period"> Período</label>
            </div>
          </div>
          <div class="form-group ex-period" style="display:none;">
            <label>Desde</label>
            <input type="date" name="ex_from" class="form-control">
          </div>
          <div class="form-group ex-period" style="display:none;">
            <label>Hasta</label>
            <input type="date" name="ex_to" class="form-control">
          </div>
          <div class="form-group" style="grid-column:1/4;">
            <label>Matrícula (opcional)</label>
            <input type="text" name="ex_plate" class="form-control" placeholder="parcial o completa">
          </div>
        </div>
        <p class="muted">Deja la matrícula vacía para exportar todo el rango elegido.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-button">Cancelar</button>
        <button type="submit" class="btn btn-primary">Exportar</button>
      </div>
    </form>
  </div>
</div>

<!-- MODAL FOTO -->
<div id="pv-photo" class="pv-backdrop" aria-hidden="true">
  <div class="pv-modal">
    <button class="pv-close" aria-label="Cerrar" onclick="pvClose()">✕</button>
    <img id="pv-img" src="" alt="captura">
    <div id="pv-meta" class="pv-meta"></div>
  </div>
</div>

<script>
  /* Export modal */
  const exportModal = document.getElementById('export-modal');
  const openExport  = document.getElementById('open-export-modal');
  const closeBtns   = exportModal.querySelectorAll('.close-button');
  openExport.addEventListener('click', ()=> exportModal.style.display='flex');
  closeBtns.forEach(btn=>btn.addEventListener('click', ()=> exportModal.style.display='none'));
  window.addEventListener('click', (e)=>{ if(e.target===exportModal) exportModal.style.display='none'; });

  const radios = exportModal.querySelectorAll('input[name="ex_scope"]');
  const periodFields = exportModal.querySelectorAll('.ex-period');
  function refreshPeriod(){
    const isPeriod = exportModal.querySelector('input[name="ex_scope"]:checked').value === 'period';
    periodFields.forEach(el=> el.style.display = isPeriod ? '' : 'none');
  }
  radios.forEach(r=> r.addEventListener('change', refreshPeriod));
  refreshPeriod();

  /* Modal de FOTO: abre sólo la imagen, overlay con datos */
  const pv = document.getElementById('pv-photo');
  const pvImg = document.getElementById('pv-img');
  const pvMeta = document.getElementById('pv-meta');

  function pvOpen(src, meta){
    pvImg.src = src;
    pvMeta.innerHTML = `
      <span class="pv-pill">Matrícula: <strong>${esc(meta.plate||'')}</strong></span>
      <span class="pv-pill">Fecha: <strong>${esc(meta.dt||'')}</strong></span>
      <span class="pv-pill">Propietario: <strong>${esc(meta.owner||'—')}</strong></span>
    `;
    pv.classList.add('show');
    pv.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function pvClose(){
    pv.classList.remove('show');
    pv.setAttribute('aria-hidden','true');
    pvImg.src='';
    document.body.style.overflow='';
  }
  pv.addEventListener('click', (e)=>{ if(e.target===pv) pvClose(); });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') pvClose(); });

  function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m])); }

  // Bind click en miniaturas (abre modal)
  document.querySelectorAll('.js-photo').forEach(img=>{
    img.addEventListener('click', ()=>{
      pvOpen(img.src, {
        plate: img.getAttribute('data-plate'),
        dt:    img.getAttribute('data-datetime'),
        owner: img.getAttribute('data-owner')
      });
    });
  });
</script>
