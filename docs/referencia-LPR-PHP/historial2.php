<?php
/**
 * historial2.php — Historial ANPR (solo lectura) listo para prod
 * - Usa config.php (PDO $pdo, APP_ROOT, sesión)
 * - Incluye menú/estilos de producción (con fallback)
 * - Grupo por matrícula, CSV, modal con overlay (matrícula/fecha/propietario)
 * - NO escribe en DB (salvo si usas tu botón de Purga)
 */

require_once __DIR__ . '/config.php';
date_default_timezone_set('America/Argentina/Buenos_Aires');

// ====== CONFIG TABLAS/CAMPOS ======
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

$publicBase = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/'); // ej: /LPR
$imgBaseURL = $publicBase ? ($publicBase.'/') : '/';
$thumbMaxW  = 120;

// ====== HELPERS ======
function e($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function qlink(array $p){ return '?'.http_build_query($p); }
function buildImageUrl(string $rel,string $base){ return rtrim($base,'/').'/'.ltrim($rel,'/'); }
function streamFromAppRoot(string $rel){
  $rel = ltrim($rel,'/\\');
  $full = realpath(APP_ROOT.DIRECTORY_SEPARATOR.$rel);
  $root = realpath(APP_ROOT);
  if(!$full || !$root || strpos($full,$root)!==0 || !is_file($full)){ http_response_code(404); echo 'Archivo no encontrado'; exit; }
  $ext=strtolower(pathinfo($full,PATHINFO_EXTENSION));
  $mime = in_array($ext,['jpg','jpeg'])?'image/jpeg':($ext==='png'?'image/png':($ext==='gif'?'image/gif':'application/octet-stream'));
  header('Content-Type: '.$mime); header('Content-Length: '.filesize($full)); readfile($full); exit;
}
function badgeDecision($d){
  $t = strtolower((string)$d);
  $cls = 'badge-neutral';
  if (strpos($t,'permitido')!==false) $cls='badge-ok';
  elseif (strpos($t,'denegado')!==false) $cls='badge-bad';
  return '<span class="badge '.$cls.'">'.e(ucwords(str_replace('_',' ', $d))).'</span>';
}
function detectColumn(PDO $pdo, string $table, array $candidates){
  $st = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?");
  $st->execute([DB_NAME,$table]);
  $cols = array_map('strtolower', array_column($st->fetchAll(), 'COLUMN_NAME'));
  foreach($candidates as $c){ if(in_array(strtolower($c), $cols, true)) return $c; }
  return null;
}

// ====== RUTAS AUX: PROXY IMG ======
if (($_GET['do'] ?? '')==='img' && isset($_GET['path'])) {
  $path = base64_decode((string)$_GET['path'], true);
  if ($path===false){ http_response_code(400); echo 'Path inválido'; exit; }
  streamFromAppRoot($path);
}

// ====== DETECCIONES ======
$deviceNameCol  = detectColumn($pdo, $tableDevices, ['name','device_name','label','alias','title']) ?: 'name';
$ownerNameCol   = detectColumn($pdo, $tableOwners,  ['name','full_name','owner_name']) ?: 'name';
$vehicleListCol = detectColumn($pdo, $tableVehicles,['list','lista','category','tag','whitelist_status','group','segment']);

// ====== ENTRADA / FILTROS ======
$items_per_page = isset($_GET['perPage']) ? max(5, min(200, (int)$_GET['perPage'])) : 25;
$current_page   = isset($_GET['p']) && is_numeric($_GET['p']) ? max(1,(int)$_GET['p']) : 1;

$search_plate     = trim($_GET['plate'] ?? '');
$search_owner     = trim($_GET['owner'] ?? '');
$search_lot       = trim($_GET['lot'] ?? '');
$search_device    = trim($_GET['device'] ?? '');   // 'entrada'|'salida'|nombre|id
$search_decision  = trim($_GET['decision'] ?? ''); // acceso_permitido|acceso_denegado
$search_date_from = trim($_GET['date_from'] ?? '');
$search_date_to   = trim($_GET['date_to'] ?? '');
$groupByPlate     = isset($_GET['groupBy']) && $_GET['groupBy']==='1';
$doExport         = isset($_GET['export']) && $_GET['export']==='1';

// ====== WHERE común ======
$where=[]; $params=[];
if ($search_plate!==''){ $where[]="e.`{$E['plate']}` LIKE :plate"; $params[':plate']="%$search_plate%"; }
if ($search_owner!==''){ $where[]="o.`$ownerNameCol` LIKE :owner"; $params[':owner']="%$search_owner%"; }
if ($search_device!==''){
  if ($search_device==='entrada') { $where[]="d.`$deviceNameCol` LIKE '%entrada%'"; }
  elseif ($search_device==='salida'){ $where[]="d.`$deviceNameCol` LIKE '%salida%'"; }
  else { $where[]="(e.`{$E['device_id']}` = :devId OR d.`$deviceNameCol` LIKE :devName)"; $params[':devId']=$search_device; $params[':devName']="%$search_device%"; }
}
if ($search_decision!==''){ $where[]="e.`{$E['decision']}` = :dec"; $params[':dec']=$search_decision; }
if ($search_date_from!==''){ $where[]="e.`{$E['ts']}` >= :d1"; $params[':d1']=$search_date_from.' 00:00:00'; }
if ($search_date_to!==''){ $where[]="e.`{$E['ts']}` <= :d2"; $params[':d2']=$search_date_to.' 23:59:59'; }
$whereSQL = $where? (' WHERE '.implode(' AND ',$where)) : '';

// ====== SELECT bases (joins de lotes/propietarios) ======
$joinBase = "FROM `$tableEvents` e
 LEFT JOIN `$tableVehicles` v ON (v.id = e.`{$E['vehicle_id']}` OR v.`{$E['plate']}` = e.`{$E['plate']}`)
 LEFT JOIN `$tableOwners`   o ON o.id = v.owner_id
 LEFT JOIN `$tableDevices`  d ON d.id = e.`{$E['device_id']}`
 LEFT JOIN `$tableOLA`     ola ON o.id = ola.owner_id
 LEFT JOIN `$tableLots`      l ON ola.lot_id = l.id";

$having = [];
$hParams = [];
if ($search_lot!==''){ $having[] = "GROUP_CONCAT(DISTINCT l.description SEPARATOR ', ') LIKE :lot"; $hParams[':lot']="%$search_lot%"; }
$havingSQL = $having ? (' HAVING '.implode(' AND ',$having)) : '';

// ====== LISTA (columna dinámica o fallback) ======
$listaSelect = $vehicleListCol
  ? "v.`$vehicleListCol` AS lista"
  : "CASE WHEN e.`{$E['decision']}`='acceso_permitido' THEN 'Permitidos'
          WHEN e.`{$E['decision']}`='acceso_denegado'  THEN 'No autorizados'
          ELSE '—' END AS lista";

// ====== PAGINACIÓN / QUERIES ======
if (!$groupByPlate) {
  // total
  $countSQL = "SELECT COUNT(DISTINCT e.`{$E['id']}`) $joinBase $whereSQL";
  $st = $pdo->prepare($countSQL);
  foreach($params as $k=>$v) $st->bindValue($k,$v);
  $st->execute();
  $total_records = (int)$st->fetchColumn();

  $total_pages = $total_records ? (int)ceil($total_records/$items_per_page) : 1;
  if ($current_page > $total_pages) $current_page = $total_pages;
  $offset = ($current_page-1)*$items_per_page;

  $dataSQL = "SELECT 
      e.`{$E['id']}` AS id, e.`{$E['plate']}` AS plate, e.`{$E['ts']}` AS timestamp,
      e.`{$E['img']}` AS image_path, e.`{$E['decision']}` AS decision,
      o.`$ownerNameCol` AS owner_name, d.`$deviceNameCol` AS device_name,
      GROUP_CONCAT(DISTINCT l.description SEPARATOR ', ') AS lot_description,
      $listaSelect
    $joinBase $whereSQL
    GROUP BY e.`{$E['id']}`
    $havingSQL
    ORDER BY e.`{$E['ts']}` DESC
    LIMIT :lim OFFSET :off";
  $st = $pdo->prepare($dataSQL);
  foreach($params as $k=>&$v) $st->bindParam($k,$v);
  foreach($hParams as $k=>&$v) $st->bindParam($k,$v);
  $st->bindValue(':lim',$items_per_page,PDO::PARAM_INT);
  $st->bindValue(':off',$offset,PDO::PARAM_INT);
  $st->execute();
  $rows = $st->fetchAll();
} else {
  // Agrupado por matrícula
  $countSQL = "SELECT COUNT(*) c FROM (
    SELECT e.`{$E['plate']}` $joinBase $whereSQL GROUP BY e.`{$E['plate']}` $havingSQL
  ) t";
  $st = $pdo->prepare($countSQL);
  foreach($params as $k=>$v) $st->bindValue($k,$v);
  foreach($hParams as $k=>$v) $st->bindValue($k,$v);
  $st->execute();
  $total_records = (int)$st->fetchColumn();

  $total_pages = $total_records ? (int)ceil($total_records/$items_per_page) : 1;
  if ($current_page > $total_pages) $current_page = $total_pages;
  $offset = ($current_page-1)*$items_per_page;

  $listaGroup = $vehicleListCol ? "MAX(v.`$vehicleListCol`) AS lista" : "CASE WHEN SUM(e.`{$E['decision']}`='acceso_permitido')>0 THEN 'Permitidos'
                                                                              WHEN SUM(e.`{$E['decision']}`='acceso_denegado')>0  THEN 'No autorizados'
                                                                              ELSE '—' END AS lista";
  $dataSQL = "SELECT
      e.`{$E['plate']}` AS plate,
      COUNT(*) AS eventos,
      MIN(e.`{$E['ts']}`) AS first_seen,
      MAX(e.`{$E['ts']}`) AS last_seen,
      SUM(e.`{$E['decision']}`='acceso_permitido') AS permitidos,
      SUM(e.`{$E['decision']}`='acceso_denegado')  AS denegados,
      MAX(o.`$ownerNameCol`) AS owner_name,
      $listaGroup,
      (SELECT e2.`{$E['img']}` FROM `$tableEvents` e2
         WHERE e2.`{$E['plate']}` = e.`{$E['plate']}`
         ORDER BY e2.`{$E['ts']}` DESC LIMIT 1) AS image_path_sample
    $joinBase $whereSQL
    GROUP BY e.`{$E['plate']}`
    $havingSQL
    ORDER BY last_seen DESC
    LIMIT :lim OFFSET :off";
  $st = $pdo->prepare($dataSQL);
  foreach($params as $k=>&$v) $st->bindParam($k,$v);
  foreach($hParams as $k=>&$v) $st->bindParam($k,$v);
  $st->bindValue(':lim',$items_per_page,PDO::PARAM_INT);
  $st->bindValue(':off',$offset,PDO::PARAM_INT);
  $st->execute();
  $rows = $st->fetchAll();
}

// ====== EXPORT (detalle o agrupado) ======
if ($doExport) {
  header('Content-Type: text/csv; charset=UTF-8');
  header('Content-Disposition: attachment; filename="'.($groupByPlate?'eventos_agrupados':'eventos_detalle').'.csv"');
  $out=fopen('php://output','w');
  fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
  $sep=';';
  if (!$groupByPlate) {
    fputs($out, "id{$sep}fecha{$sep}matricula{$sep}propietario{$sep}lote{$sep}camara{$sep}decision{$sep}lista{$sep}imagen\n");
    foreach($rows as $r){
      $line=[ $r['id'],$r['timestamp'],$r['plate'],$r['owner_name'],$r['lot_description'],$r['device_name'],$r['decision'],$r['lista'],$r['image_path'] ];
      fputs($out, implode($sep, array_map(fn($v)=>str_replace(["\n","\r",$sep],[' ',' ','‚'], (string)$v), $line))."\n");
    }
  } else {
    fputs($out, "matricula{$sep}eventos{$sep}primer_visto{$sep}ultimo_visto{$sep}permitidos{$sep}denegados{$sep}propietario{$sep}lista{$sep}imagen_sample\n");
    foreach($rows as $r){
      $line=[ $r['plate'],$r['eventos'],$r['first_seen'],$r['last_seen'],$r['permitidos'],$r['denegados'],$r['owner_name'],$r['lista'],$r['image_path_sample'] ];
      fputs($out, implode($sep, array_map(fn($v)=>str_replace(["\n","\r",$sep],[' ',' ','‚'], (string)$v), $line))."\n");
    }
  }
  fclose($out); exit;
}

$is_filtered = (bool)array_filter([$search_plate,$search_owner,$search_lot,$search_device,$search_decision,$search_date_from,$search_date_to]);

// ====== Menú/estilos prod (incluye parciales si existen) ======
$menuIncluded = false;
foreach ([APP_ROOT.'/partials/menu.php', APP_ROOT.'/includes/menu.php', APP_ROOT.'/partials/navbar.php', APP_ROOT.'/includes/navbar.php'] as $inc){
  if (is_file($inc)){ $menuIncluded=$inc; break; }
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Historial (v2) — ANPR</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Tus CSS de producción -->
  <link rel="stylesheet" href="<?= e($publicBase) ?>/assets/css/app.css">
  <link rel="stylesheet" href="<?= e($publicBase) ?>/css/historial.css">
  <!-- Fallback mínimo -->
  <style>
    :root{ --ok:#16a34a; --bad:#dc2626; --neutral:#6b7280; --border:#e5e7eb; }
    body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f6f7f9;color:#111}
    .container{max-width:1400px;margin:0 auto;padding:24px}
    h1{margin:8px 0 12px}
    .card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
    .btn{display:inline-block;padding:9px 14px;border-radius:10px;border:1px solid #d1d5db;background:#111;color:#fff;text-decoration:none;cursor:pointer}
    .btn.secondary{background:#f9fafb;color:#111}
    .muted{color:#6b7280;font-size:12px}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}
    th,td{padding:10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
    th{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.03em}
    .pagination-container{display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;padding:.5rem 0;gap:1rem;border-top:1px solid var(--border)}
    .pagination-links{display:flex;gap:.5rem;flex-wrap:wrap}
    .pagination-links a,.pagination-links span{padding:.5rem .8rem;border:1px solid var(--border);border-radius:10px;text-decoration:none}
    .pagination-links .active{background:#111;color:#fff;border-color:#111}
    .pagination-links .disabled{opacity:.5}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px}
    .badge-ok{background:rgba(22,163,74,.1);color:#16a34a;border:1px solid rgba(22,163,74,.2)}
    .badge-bad{background:rgba(220,38,38,.1);color:#dc2626;border:1px solid rgba(220,38,38,.2)}
    .badge-neutral{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}
    .styled-plate{font-weight:600;letter-spacing:.5px}
    .thumb{max-width:<?= (int)$thumbMaxW ?>px;height:auto;object-fit:cover;border-radius:10px;border:1px solid var(--border);cursor:pointer}
    /* Navbar fallback */
    .navbar{position:sticky;top:0;z-index:99;background:#111;color:#fff}
    .navbar .inner{max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:12px 24px}
    .navbar a{color:#fff;text-decoration:none;margin-right:16px;opacity:.9}
    .navbar a:hover{opacity:1}
    .brand{font-weight:700}
    /* Modal con blur + overlay meta */
    .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999}
    .modal-backdrop.show{display:flex}
    .modal-wrap{position:relative;max-width:92vw;max-height:86vh;border-radius:12px;overflow:hidden;background:#000}
    .modal-wrap img{display:block;max-width:92vw;max-height:86vh}
    .modal-meta{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,0));color:#fff;font-size:14px}
    .meta-pill{display:inline-block;margin-right:8px;margin-bottom:4px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.15);backdrop-filter:blur(2px)}
    .modal-close{position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:999px;padding:8px 10px;cursor:pointer}
    /* FAB (se reutiliza el tuyo) */
    .fab-container{position:fixed;bottom:2rem;right:2rem;z-index:1000}
    .fab-main{width:56px;height:56px;border-radius:50%;background:#111;color:#fff;border:none;cursor:pointer}
    .fab-menu{display:flex;flex-direction:column;align-items:center;margin-bottom:1rem;transform:scaleY(0);transform-origin:bottom;transition:transform .3s}
    .fab-container.active .fab-menu{transform:scaleY(1)}
    .fab-action{width:48px;height:48px;border-radius:50%;background:#fff;border:1px solid var(--border);cursor:pointer;margin-bottom:.75rem}
  </style>
</head>
<body>

<?php if ($menuIncluded): include $menuIncluded; ?><div class="container"><?php else: ?>
<nav class="navbar"><div class="inner">
  <div class="brand"><a href="<?= e($publicBase) ?>/index.php">LPR</a></div>
  <div>
    <a href="<?= e($publicBase) ?>/index.php">Dashboard</a>
    <a href="<?= e($publicBase) ?>/historial.php">Historial</a>
    <a href="<?= e($publicBase) ?>/historial2.php"><strong>Historial v2</strong></a>
    <a href="<?= e($publicBase) ?>/devices.php">Dispositivos</a>
    <a href="<?= e($publicBase) ?>/vehicles.php">Vehículos</a>
    <a href="<?= e($publicBase) ?>/owners.php">Propietarios</a>
  </div>
  <div class="muted">Usuario: <?= e($_SESSION['user_name'] ?? $_SESSION['user_id'] ?? '—') ?></div>
</div></nav>
<div class="container">
<?php endif; ?>

<h1>Historial (v2)</h1>

<!-- Filtros (idénticos a tu modal, pero accesibles aquí) -->
<form action="historial2.php" method="GET" class="card" style="margin-bottom:12px">
  <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px">
    <div><label class="muted">Matrícula</label><input type="text" name="plate" value="<?= e($search_plate) ?>" class="form-control"></div>
    <div><label class="muted">Propietario</label><input type="text" name="owner" value="<?= e($search_owner) ?>" class="form-control"></div>
    <div><label class="muted">Lote</label><input type="text" name="lot" value="<?= e($search_lot) ?>" class="form-control"></div>
    <div>
      <label class="muted">Cámara</label>
      <input type="text" name="device" value="<?= e($search_device) ?>" class="form-control" placeholder="entrada / salida / nombre / id">
    </div>
    <div>
      <label class="muted">Decisión</label>
      <select name="decision" class="form-control">
        <option value="">— todas —</option>
        <option value="acceso_permitido" <?= $search_decision==='acceso_permitido'?'selected':''; ?>>acceso_permitido</option>
        <option value="acceso_denegado"  <?= $search_decision==='acceso_denegado' ?'selected':''; ?>>acceso_denegado</option>
      </select>
    </div>
    <div style="display:flex;align-items:end;gap:12px">
      <label class="muted" style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" name="groupBy" value="1" <?= $groupByPlate?'checked':''; ?>> Agrupar por matrícula
      </label>
    </div>
    <div><label class="muted">Desde</label><input type="date" name="date_from" value="<?= e($search_date_from) ?>" class="form-control"></div>
    <div><label class="muted">Hasta</label><input type="date" name="date_to" value="<?= e($search_date_to) ?>" class="form-control"></div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
    <button class="btn" type="submit">Aplicar</button>
    <a class="btn secondary" href="historial2.php">Limpiar</a>
    <a class="btn secondary" href="<?= e(qlink(array_merge($_GET,['export'=>'1']))) ?>">Exportar CSV</a>
    <span class="muted" style="margin-left:auto">Total: <strong><?= (int)$total_records ?></strong></span>
    <label class="muted" style="margin-left:12px">Por página</label>
    <form method="get">
      <?php foreach(['plate','owner','lot','device','decision','date_from','date_to','groupBy'] as $k){ if(isset($_GET[$k])) echo '<input type="hidden" name="'.e($k).'" value="'.e($_GET[$k]).'">'; } ?>
      <select name="perPage" class="form-control" onchange="this.form.submit()">
        <?php foreach([10,25,50,100,200] as $pp): ?>
          <option value="<?= $pp ?>" <?= $pp==$items_per_page?'selected':'' ?>><?= $pp ?></option>
        <?php endforeach; ?>
      </select>
    </form>
  </div>
</form>

<div class="card">
  <?php if (!$groupByPlate): ?>
    <table>
      <thead>
        <tr>
          <th>Fecha y Hora</th><th>Matrícula</th><th>Propietario</th><th>Lote</th><th>Cámara</th><th>Decisión</th><th>Lista</th><th>Captura</th>
        </tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
          <tr><td colspan="8" style="text-align:center;padding:2rem">No se encontraron eventos. <?= $is_filtered ? 'Pruebe a cambiar o limpiar los filtros.' : '' ?></td></tr>
        <?php else: foreach($rows as $r):
          $file = trim((string)($r['image_path'] ?? ''));
          $urlPub  = $file? buildImageUrl($file,$imgBaseURL) : '';
          $urlProx = $file? qlink(['do'=>'img','path'=>base64_encode($file)]) : '';
        ?>
          <tr>
            <td><?= e($r['timestamp']) ?></td>
            <td><span class="styled-plate"><?= e($r['plate']) ?></span></td>
            <td><?= e($r['owner_name'] ?? 'N/A') ?></td>
            <td><?= e($r['lot_description'] ?? 'N/A') ?></td>
            <td><?= e($r['device_name'] ?? 'N/A') ?></td>
            <td><?= badgeDecision($r['decision']) ?></td>
            <td><?= e($r['lista'] ?? '—') ?></td>
            <td>
              <?php if ($file): ?>
                <img class="thumb" src="<?= e($urlPub) ?>"
                     data-proxy="<?= e($urlProx) ?>"
                     data-plate="<?= e($r['plate']) ?>"
                     data-datetime="<?= e($r['timestamp']) ?>"
                     data-owner="<?= e($r['owner_name'] ?? '—') ?>"
                     alt="captura">
              <?php else: ?>N/A<?php endif; ?>
            </td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>Matrícula</th><th>Eventos</th><th>Primer visto</th><th>Último visto</th><th>Permitidos</th><th>Denegados</th><th>Propietario</th><th>Lista</th><th>Captura</th>
        </tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
          <tr><td colspan="9" style="text-align:center;padding:2rem">No hay resultados.</td></tr>
        <?php else: foreach($rows as $r):
          $file = trim((string)($r['image_path_sample'] ?? ''));
          $urlPub  = $file? buildImageUrl($file,$imgBaseURL) : '';
          $urlProx = $file? qlink(['do'=>'img','path'=>base64_encode($file)]) : '';
        ?>
          <tr>
            <td><span class="styled-plate"><?= e($r['plate']) ?></span></td>
            <td><?= (int)$r['eventos'] ?></td>
            <td><?= e($r['first_seen']) ?></td>
            <td><?= e($r['last_seen']) ?></td>
            <td><span class="badge badge-ok"><?= (int)$r['permitidos'] ?></span></td>
            <td><span class="badge badge-bad"><?= (int)$r['denegados'] ?></span></td>
            <td><?= e($r['owner_name'] ?? '—') ?></td>
            <td><?= e($r['lista'] ?? '—') ?></td>
            <td>
              <?php if ($file): ?>
                <img class="thumb" src="<?= e($urlPub) ?>"
                     data-proxy="<?= e($urlProx) ?>"
                     data-plate="<?= e($r['plate']) ?>"
                     data-datetime="<?= e($r['last_seen']) ?>"
                     data-owner="<?= e($r['owner_name'] ?? '—') ?>"
                     alt="captura">
              <?php else: ?>N/A<?php endif; ?>
            </td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  <?php endif; ?>

  <?php if ($total_pages > 1): ?>
    <div class="pagination-container">
      <div class="pagination-info muted">
        Página <strong><?= $current_page ?></strong> de <strong><?= $total_pages ?></strong> (<?= $total_records ?> resultados)
      </div>
      <nav class="pagination-links">
        <?php
          $q = $_GET; unset($q['p']); $base = 'historial2.php?'.http_build_query($q).'&p=';
          echo $current_page>1 ? '<a href="'.$base.($current_page-1).'">« Anterior</a>' : '<span class="disabled">« Anterior</span>';
          $window=1; $start=max(1,$current_page-$window); $end=min($total_pages,$current_page+$window);
          if ($start>1){ echo '<a href="'.$base.'1">1</a>'.($start>2?'<span class="dots">...</span>':''); }
          for($i=$start;$i<=$end;$i++){ echo '<a href="'.$base.$i.'" class="'.($i==$current_page?'active':'').'">'.$i.'</a>'; }
          if ($end<$total_pages){ echo ($end<$total_pages-1?'<span class="dots">...</span>':'').'<a href="'.$base.$total_pages.'">'.$total_pages.'</a>'; }
          echo $current_page<$total_pages ? '<a href="'.$base.($current_page+1).'">Siguiente »</a>' : '<span class="disabled">Siguiente »</span>';
        ?>
      </nav>
    </div>
  <?php endif; ?>
</div>

<!-- FAB (filtros + purga como en tu versión) -->
<div class="fab-container">
  <div class="fab-menu">
    <button class="fab-action" id="open-filter-modal-btn" title="Abrir Filtros">🔎</button>
    <button class="fab-action" id="purge-events-btn" title="Purgar Historial de Eventos">🗑️</button>
  </div>
  <button class="fab-main" id="fab-main-toggle">＋</button>
</div>

<!-- Modal Imagen -->
<div id="imgModal" class="modal-backdrop" aria-hidden="true">
  <div class="modal-wrap">
    <button class="modal-close" aria-label="Cerrar" onclick="closeImgModal()">✕</button>
    <img id="imgModalSrc" src="" alt="captura">
    <div id="imgModalMeta" class="modal-meta"></div>
  </div>
</div>

<!-- Tu modal de filtros original (abre con FAB) -->
<div id="filter-modal" class="modal" style="display:none">
  <div class="modal-content-wrapper">
    <form action="historial2.php" method="GET">
      <div class="modal-header"><h2>Filtros de Búsqueda</h2><span class="close-button">×</span></div>
      <div class="modal-body">
        <div class="filter-grid">
          <div class="form-group"><label for="plate">Matrícula:</label><input type="text" name="plate" id="plate" value="<?= e($search_plate) ?>" class="form-control"></div>
          <div class="form-group"><label for="owner">Propietario:</label><input type="text" name="owner" id="owner" value="<?= e($search_owner) ?>" class="form-control"></div>
          <div class="form-group"><label for="lot">Lote:</label><input type="text" name="lot" id="lot" value="<?= e($search_lot) ?>" class="form-control"></div>
          <div class="form-group"><label for="device">Tipo de Cámara:</label>
            <select name="device" id="device" class="form-control">
              <option value="">Todas</option>
              <option value="entrada" <?= $search_device==='entrada'?'selected':''; ?>>Solo Entradas</option>
              <option value="salida"  <?= $search_device==='salida'?'selected':''; ?>>Solo Salidas</option>
            </select>
          </div>
          <div class="form-group"><label for="decision">Decisión:</label>
            <select name="decision" id="decision" class="form-control">
              <option value="">Todas</option>
              <option value="acceso_permitido" <?= $search_decision==='acceso_permitido'?'selected':''; ?>>Permitidos</option>
              <option value="acceso_denegado"  <?= $search_decision==='acceso_denegado'?'selected':''; ?>>Denegados</option>
            </select>
          </div>
          <div class="form-group"><label for="date_from">Desde:</label><input type="date" name="date_from" id="date_from" value="<?= e($search_date_from) ?>" class="form-control"></div>
          <div class="form-group"><label for="date_to">Hasta:</label><input type="date" name="date_to" id="date_to" value="<?= e($search_date_to) ?>" class="form-control"></div>
          <div class="form-group"><label><input type="checkbox" name="groupBy" value="1" <?= $groupByPlate?'checked':''; ?>> Agrupar por matrícula</label></div>
        </div>
      </div>
      <div class="modal-footer">
        <a href="historial2.php" class="btn btn-secondary">Limpiar</a>
        <button type="submit" class="btn btn-primary">Aplicar</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Purga (opcional, igual a tu versión) -->
<div id="purgeEventsModal" class="modal" style="display:none;">
  <div class="modal-content-wrapper">
    <div class="modal-header"><h2>Confirmar Purga Total</h2><span class="close-button">×</span></div>
    <div class="modal-body">
      <p><strong>¡ADVERTENCIA!</strong> Acción permanente.</p>
      <p>Escriba <strong>BORRAR</strong> para confirmar:</p>
      <input type="text" id="purge-confirm-input" class="form-control" autocomplete="off" placeholder="BORRAR">
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary close-button">Cancelar</button>
      <button type="button" id="confirm-purge-btn" class="btn btn-danger" disabled>Sí, Eliminar Todo</button>
    </div>
  </div>
</div>

<script>
  // FAB
  const fabC = document.querySelector('.fab-container');
  document.getElementById('fab-main-toggle').addEventListener('click', ()=> fabC.classList.toggle('active'));

  // Modal filtros
  const filterModal = document.getElementById('filter-modal');
  document.getElementById('open-filter-modal-btn').addEventListener('click', ()=> filterModal.style.display='flex');
  filterModal.querySelectorAll('.close-button').forEach(btn=>btn.addEventListener('click',()=> filterModal.style.display='none'));
  window.addEventListener('click',e=>{ if(e.target===filterModal) filterModal.style.display='none'; });

  // Imagen: fallback a proxy + modal con overlay meta
  document.querySelectorAll('img.thumb').forEach(img=>{
    img.addEventListener('error', ()=>{
      const prox = img.getAttribute('data-proxy');
      if (prox && !img.dataset.triedProxy){ img.dataset.triedProxy='1'; img.src=prox; }
    });
    img.addEventListener('click', ()=> openImgModal(img.src, {
      plate: img.getAttribute('data-plate') || '',
      dt:    img.getAttribute('data-datetime') || '',
      owner: img.getAttribute('data-owner') || ''
    }));
  });
  const imgModal=document.getElementById('imgModal');
  const imgModalSrc=document.getElementById('imgModalSrc');
  const imgModalMeta=document.getElementById('imgModalMeta');
  function openImgModal(src, meta){
    imgModalSrc.src=src;
    imgModalMeta.innerHTML = `
      <span class="meta-pill">Matrícula: <strong>${esc(meta.plate)}</strong></span>
      <span class="meta-pill">Fecha: <strong>${esc(meta.dt)}</strong></span>
      <span class="meta-pill">Propietario: <strong>${esc(meta.owner||'—')}</strong></span>`;
    imgModal.classList.add('show'); imgModal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  }
  function closeImgModal(){ imgModal.classList.remove('show'); imgModal.setAttribute('aria-hidden','true'); imgModalSrc.src=''; document.body.style.overflow=''; }
  imgModal.addEventListener('click', e=>{ if(e.target===imgModal) closeImgModal(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeImgModal(); });
  function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  // Purga (igual a tu flujo; requiere purge_events.php + CSRF si lo usas)
  const purgeModal = document.getElementById('purgeEventsModal');
  document.getElementById('purge-events-btn').addEventListener('click', ()=> purgeModal.style.display='flex');
  purgeModal.querySelectorAll('.close-button').forEach(btn=>btn.addEventListener('click',()=> purgeModal.style.display='none'));
  window.addEventListener('click',e=>{ if(e.target===purgeModal) purgeModal.style.display='none'; });
  const confirmInput=document.getElementById('purge-confirm-input');
  const confirmBtn=document.getElementById('confirm-purge-btn');
  if (confirmInput && confirmBtn) {
    confirmInput.addEventListener('input',()=>{ confirmBtn.disabled = confirmInput.value.trim()!=='BORRAR'; });
    confirmBtn.addEventListener('click',()=>{ alert('Implementar llamada a purge_events.php aquí si deseas mantener la purga.'); });
  }
</script>

</div><!-- /container -->
</body>
</html>
