<?php
/**
 * api_helpers.php - Librería Central de Funciones para la API de Hikvision (Versión Final)
 */

/**
 * Lee la lista blanca de una cámara y devuelve solo los números de matrícula.
 * Usa un endpoint que no siempre devuelve IDs internos.
 */
function getWhitelistFromCamera($camera) {
    // Tu función original no cambia, es útil para comprobaciones rápidas.
    $all_plates = [];
    $start_position = 0;
    $page_size = 400;
    $keep_fetching = true;
    while ($keep_fetching) {
        $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/searchLPListAudit";
        $xml_data = '<?xml version="1.0" encoding="UTF-8"?><LPSearchCond><searchID>'.uniqid().'</searchID><maxResult>'.$page_size.'</maxResult><searchResultPosition>'.$start_position.'</searchResultPosition></LPSearchCond>';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
            CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}", CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $xml_data, CURLOPT_HTTPHEADER => ['Content-Type: application/xml'],
            CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10
        ]);
        $response_xml = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        if ($curl_error || $http_code !== 200) {
            return ['success' => false, 'data' => "Error en paginación: " . ($curl_error ?: "HTTP {$http_code}")];
        }
        libxml_use_internal_errors(true);
        $xml_object = simplexml_load_string($response_xml);
        if ($xml_object === false) { return ['success' => false, 'data' => 'XML no válido.']; }
        if (isset($xml_object->LicensePlateInfoList->LicensePlateInfo)) {
            $current_page_plates = [];
            foreach ($xml_object->LicensePlateInfoList->LicensePlateInfo as $plate_info) {
                $current_page_plates[] = ['plate_number' => (string)($plate_info->LicensePlate ?? 'N/A')];
            }
            $all_plates = array_merge($all_plates, $current_page_plates);
            if (count($current_page_plates) < $page_size) { $keep_fetching = false; } else { $start_position += $page_size; }
        } else { $keep_fetching = false; }
    }
    return ['success' => true, 'data' => $all_plates];
}

// ===== INICIO DE LAS NUEVAS FUNCIONES Y CORRECCIONES =====

/**
 * [NUEVA FUNCIÓN] Lee la lista blanca de una cámara y devuelve un mapeo de [plate => internal_id].
 * Esta es la función clave para poder borrar matrículas.
 */
function getWhitelistWithInternalIDs($camera) {
    $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/licensePlateAuditData?format=json&listType=whiteList";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'data' => "Error cURL: " . $error];
    }
    
    if ($http_code !== 200) {
        return ['success' => false, 'data' => "Error HTTP {$http_code}"];
    }

    $response_data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE || !isset($response_data['LicensePlateInfoList'])) {
        return ['success' => false, 'data' => "Respuesta JSON inválida o inesperada de la cámara."];
    }

    $plate_to_id_map = [];
    if (isset($response_data['LicensePlateInfoList'])) {
        foreach ($response_data['LicensePlateInfoList'] as $item) {
            if (isset($item['LicensePlate']) && isset($item['id'])) {
                $plate_to_id_map[strtoupper($item['LicensePlate'])] = $item['id'];
            }
        }
    }

    return ['success' => true, 'data' => $plate_to_id_map];
}

/**
 * [FUNCIÓN CORREGIDA] Añade una matrícula a la lista blanca de una cámara.
 */
function addPlateToCameraWhitelist($camera, $plate) {
    $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/licensePlateAuditData/record?format=json";
    
    $now = new DateTime("now", new DateTimeZone('America/Argentina/Buenos_Aires'));
    $createTime = $now->format('Y-m-d\TH:i:s');
    $startDate = $now->format('Y-m-d');
    $endDate = $now->modify('+10 years')->format('Y-m-d');

    $payload = [
        "LicensePlateInfoList" => [[
            "LicensePlate" => $plate,
            "listType" => "whiteList",
            "createTime" => $createTime,
            "effectiveStartDate" => $startDate,
            "effectiveTime" => $endDate,
            "id" => ""
        ]]
    ];
    $json_payload = json_encode($payload);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => "PUT",
        CURLOPT_POSTFIELDS => $json_payload, CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 15
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) return ['success' => false, 'message' => "Error cURL: " . $error];
    
    $response_data = json_decode($response, true);
    if ($http_code == 200 && isset($response_data['statusCode']) && $response_data['statusCode'] == 1) {
        return ['success' => true, 'message' => "Matrícula '{$plate}' añadida."];
    } else {
        $error_msg = $response_data['statusString'] ?? substr($response, 0, 100);
        return ['success' => false, 'message' => "La cámara devolvió un error (HTTP {$http_code}): " . $error_msg];
    }
}

/**
 * [FUNCIÓN CORREGIDA] Elimina una matrícula (usando su ID interno) de la lista blanca de una cámara.
 */
function deletePlateFromCameraWhitelist($camera, $internal_id) {
    $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/DelLicensePlateAuditData?format=json";

    $payload = [
        "id" => [ (string)$internal_id ] // La cámara espera un array de strings
    ];
    $json_payload = json_encode($payload);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => "PUT",
        CURLOPT_POSTFIELDS => $json_payload, CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 15
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) return ['success' => false, 'message' => "Error cURL: " . $error];

    $response_data = json_decode($response, true);
    if ($http_code == 200 && isset($response_data['statusCode']) && $response_data['statusCode'] == 1) {
        return ['success' => true, 'message' => "Matrícula con ID {$internal_id} eliminada."];
    } else {
        $error_msg = $response_data['statusString'] ?? substr($response, 0, 100);
        return ['success' => false, 'message' => "La cámara devolvió un error (HTTP {$http_code}): " . $error_msg];
    }
}

?>