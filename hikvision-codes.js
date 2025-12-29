// Mapeo de códigos Hikvision a valores legibles
// Basado en la documentación de Hikvision ANPR

// Códigos de Color de Vehículo (en Español)
const HIKVISION_VEHICLE_COLORS = {
    0: 'Desconocido',
    1: 'Blanco',
    2: 'Plateado',
    3: 'Gris',
    4: 'Negro',
    5: 'Rojo',
    6: 'Azul Oscuro',
    7: 'Azul',
    8: 'Amarillo',
    9: 'Verde',
    10: 'Marrón',
    11: 'Rosa',
    12: 'Púrpura',
    13: 'Púrpura Oscuro',
    14: 'Cian'
};

// Códigos de Marca de Vehículo
const HIKVISION_VEHICLE_BRANDS = {
    0: 'Desconocido',
    1: 'Volkswagen',
    2: 'Buick',
    3: 'BMW',
    4: 'Honda',
    5: 'Nissan',
    6: 'Audi',
    7: 'Citroen',
    8: 'Mercedes-Benz',
    9: 'Peugeot',
    10: 'Ford',
    11: 'Mazda',
    12: 'Chevrolet',
    13: 'Chery',
    14: 'Toyota',
    15: 'Kia',
    16: 'Hyundai',
    17: 'Mitsubishi',
    18: 'Renault',
    19: 'Suzuki',
    20: 'Fiat',
    21: 'Skoda',
    22: 'Lexus',
    23: 'Volvo',
    24: 'Subaru',
    25: 'Jeep',
    26: 'Dodge',
    27: 'Chrysler',
    28: 'Cadillac',
    29: 'Lincoln',
    30: 'Infiniti',
    31: 'Acura',
    32: 'Porsche',
    33: 'Land Rover',
    34: 'Jaguar',
    35: 'Mini',
    36: 'Bentley',
    37: 'Ferrari',
    38: 'Lamborghini',
    39: 'Maserati',
    40: 'Alfa Romeo',
    1036: 'Mercedes-Benz', // Código específico detectado en logs
    1037: 'BMW', // Código específico detectado en logs
    1044: 'Peugeot', // Código específico detectado en logs
    1043: 'Honda', // Código específico detectado en logs
    1053: 'Volkswagen', // Código específico detectado en logs
    1060: 'Toyota', // Código específico detectado en logs
    1064: 'Ford', // Código específico detectado en logs
    1084: 'Jeep', // Código específico detectado en logs
    1102: 'Suzuki', // Código específico detectado en logs
    1104: 'Lexus', // Código específico detectado en logs
    1105: 'Renault', // Código específico detectado en logs
    1116: 'Opel', // Código específico detectado en logs
    1121: 'Kia', // Código específico detectado en logs
    1123: 'Nissan', // Código específico detectado en logs
    1133: 'Subaru', // Código específico detectado en logs
    1139: 'Tesla', // Código específico detectado en logs
    1149: 'Hyundai', // Código específico detectado en logs
    1151: 'Chevrolet', // Código específico detectado en logs
    1576: 'Huanghai', // Código específico detectado en logs
    1579: 'JAC', // Código específico detectado en logs
    1737: 'Foton Fordland', // Código específico detectado en logs
    1806: 'XPeng', // Código específico detectado en logs
};

/**
 * Convierte un código de color de Hikvision a texto legible en español
 */
function getVehicleColorName(code) {
    if (!code || code === 'Unknown' || code === 'Desconocido') return 'Desconocido';
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return HIKVISION_VEHICLE_COLORS[numCode] || `Color ${code}`;
}

/**
 * Convierte un código de marca de Hikvision a texto legible
 */
function getVehicleBrandName(code) {
    if (!code || code === 'Unknown' || code === 'Desconocido') return 'Desconocido';
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return HIKVISION_VEHICLE_BRANDS[numCode] || `Marca ${code}`;
}

module.exports = {
    HIKVISION_VEHICLE_COLORS,
    HIKVISION_VEHICLE_BRANDS,
    getVehicleColorName,
    getVehicleBrandName
};
