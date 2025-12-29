// Mapeo de códigos Hikvision a valores legibles
// Basado en la documentación de Hikvision ANPR

// Códigos de Color de Vehículo
export const HIKVISION_VEHICLE_COLORS: { [key: number]: string } = {
    0: 'Unknown',
    1: 'White',
    2: 'Silver',
    3: 'Gray',
    4: 'Black',
    5: 'Red',
    6: 'Dark Blue',
    7: 'Blue',
    8: 'Yellow',
    9: 'Green',
    10: 'Brown',
    11: 'Pink',
    12: 'Purple',
    13: 'Dark Purple',
    14: 'Cyan'
};

// Códigos de Marca de Vehículo (los más comunes)
export const HIKVISION_VEHICLE_BRANDS: { [key: number]: string } = {
    0: 'Unknown',
    1: 'Volkswagen',
    2: 'Buick',
    3: 'BMW',
    4: 'Honda',
    5: 'Nissan',
    6: 'Audi',
    7: 'Citroen',
    8: 'Benz',
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
    // ... más marcas según necesidad
    1030: 'Porsche',
    1064: 'Ford',
    1112: 'Mazda',
    1144: 'Volvo',
    1559: 'Foton',
    1775: 'Isuzu',
    1951: 'FAW',
};

// Códigos de Tipo de Vehículo
export const HIKVISION_VEHICLE_TYPES: { [key: number]: string } = {
    0: 'Unknown',
    1: 'Passenger Car',
    2: 'Large Vehicle',
    3: 'Motorcycle',
    4: 'Non-motor Vehicle',
    5: 'Small Truck',
    6: 'Light Truck',
    7: 'Medium Truck',
    8: 'Heavy Truck',
    9: 'Minibus',
    10: 'Large Bus',
    11: 'SUV',
    12: 'MPV',
    13: 'Pickup Truck',
    14: 'Sedan',
    15: 'Hatchback',
    16: 'Coupe',
    17: 'Wagon',
    18: 'Van'
};

/**
 * Convierte un código de color de Hikvision a texto legible
 */
export function getVehicleColorName(code: string | number): string {
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return HIKVISION_VEHICLE_COLORS[numCode] || `Color ${code}`;
}

/**
 * Convierte un código de marca de Hikvision a texto legible
 */
export function getVehicleBrandName(code: string | number): string {
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return HIKVISION_VEHICLE_BRANDS[numCode] || `Brand ${code}`;
}

/**
 * Convierte un código de tipo de Hikvision a texto legible
 */
export function getVehicleTypeName(code: string | number): string {
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return HIKVISION_VEHICLE_TYPES[numCode] || code.toString();
}
