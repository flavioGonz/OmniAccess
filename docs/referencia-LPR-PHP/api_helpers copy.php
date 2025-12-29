<?php
/**
 * api_helpers.php - Librería Central de Funciones para la API de Hikvision (Actualizada)
 */

function getWhitelistFromCamera($camera) {
    // ... Tu función original getWhitelistFromCamera no necesita cambios ...
    // La dejo aquí para que el archivo esté completo.
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
            return ['success' => false, 'data' => "Error en paginación (desde {$start_position}): " . ($curl_error ?: "Error HTTP {$http_code}")];
        }

        libxml_use_internal_errors(true);
        $xml_object = simplexml_load_string($response_xml);

        if ($xml_object === false) {
            return ['success' => false, 'data' => 'Error: la cámara devolvió un XML no válido.'];
        }

        if (isset($xml_object->LicensePlateInfoList->LicensePlateInfo)) {
            $current_page_plates = [];
            foreach ($xml_object->LicensePlateInfoList->LicensePlateInfo as $plate_info) {
                $current_page_plates[] = ['plate_number' => (string)($plate_info->LicensePlate ?? 'N/A')];
            }
            
            $all_plates = array_merge($all_plates, $current_page_plates);
            
            if (count($current_page_plates) < $page_size) {
                $keep_fetching = false;
            } else {
                $start_position += $page_size;
            }
        } else {
            $keep_fetching = false;
        }
    }

    return ['success' => true, 'data' => $all_plates];
}

// ===== INICIO DE LA MODIFICACIÓN =====

/**
 * Añade una matrícula a la lista blanca de una cámara específica.
 * UTILIZA EL FORMATO JSON VALIDADO QUE CAPTURASTE.
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
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => "PUT",
        CURLOPT_POSTFIELDS => $json_payload,
        CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'message' => "Error cURL: " . $error];
    }

    $response_data = json_decode($response, true);
    if ($http_code == 200 && isset($response_data['statusCode']) && $response_data['statusCode'] == 1) {
        return ['success' => true, 'message' => "Matrícula '{$plate}' añadida."];
    } else {
        return ['success' => false, 'message' => "La cámara devolvió un error (HTTP {$http_code}): " . ($response_data['statusString'] ?? $response)];
    }
}

/**
 * Elimina una matrícula de la lista blanca de una cámara.
 * ¡IMPORTANTE! Este endpoint debe ser validado con tu api_tester.php
 */
function deletePlateFromCameraWhitelist($camera, $plate) {
    // Este es el endpoint más probable para eliminar. Si no funciona, necesitaremos capturarlo.
    $url = "http://{$camera['ip']}/ISAPI/Traffic/channels/1/licensePlateAuditData/delrecord?format=json";

    $payload = [
        "LicensePlateInfoList" => [[
            "LicensePlate" => $plate
        ]]
    ];
    $json_payload = json_encode($payload);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => "PUT", // A menudo, borrar es un PUT con un payload específico
        CURLOPT_POSTFIELDS => $json_payload,
        CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => "{$camera['username']}:{$camera['password']}",
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'message' => "Error cURL: " . $error];
    }

    $response_data = json_decode($response, true);
    if ($http_code == 200 && isset($response_data['statusCode']) && $response_data['statusCode'] == 1) {
        return ['success' => true, 'message' => "Matrícula '{$plate}' eliminada."];
    } else {
        return ['success' => false, 'message' => "La cámara devolvió un error (HTTP {$http_code}): " . ($response_data['statusString'] ?? $response)];
    }
}
// ===== FIN DE LA MODIFICACIÓN =====
?>