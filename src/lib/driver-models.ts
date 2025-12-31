// Centralized driver models configuration
export const DRIVER_MODELS = {
    HIKVISION: [
    
        { value: "iDS-2CD7A26G0/P-IZHS", label: "iDS-2CD7A26G0/P-IZHS", category: "LPR", photo: "https://chipcom.com.gt/_next/image?url=https%3A%2F%2Fftp3.syscom.mx%2Fusuarios%2Ffotos%2FBancoFotografiasSyscom%2FHIKVISION%2FIDS2CD7A26G0IZHS(C)%2FIDS2CD7A26G0IZHS(C)-p.PNG&w=256&q=75" },
    
        { value: "iDS-2CD7A26G0-IZHS", label: "iDS-2CD7A26G0-IZHS", category: "Face", photo: "" },
    ],
    AKUVOX: [    
        { value: "E18", label: "E18", category: "Terminal Face", photo: "https://www.akuvox.com/uploads/images/Products-Door-PhoneE18.png" },
    
        { value: "R27k", label: "R27k", category: "Terminal Acceso", photo: "https://www.akuvox.com/uploads/images/%E8%8F%9C%E5%8D%95%E5%9B%BE-new.png" },
    ],
    DAHUA: [
        { value: "ITC215-PW6M", label: "ITC215-PW6M", category: "LPR Camera", photo: "" },
        { value: "DH-IPC-HFW5241E-Z12E", label: "DH-IPC-HFW5241E-Z12E", category: "LPR Camera", photo: "" },
        { value: "ASI7213Y", label: "ASI7213Y", category: "Face Terminal", photo: "" },
    ],
    ZKTECO: [
        { value: "SpeedFace-V5L", label: "SpeedFace-V5L", category: "Bio Time", photo: "" },
        { value: "ProFace X", label: "ProFace X", category: "Face Terminal", photo: "" },
        { value: "MB460", label: "MB460", category: "Access Control", photo: "" },
    ],
    AXIS: [
        { value: "P1455-LE", label: "P1455-LE", category: "LPR Camera", photo: "" },
        { value: "P1455-LE-3", label: "P1455-LE-3", category: "LPR Camera", photo: "" },
    ],
    INTELBRAS: [
        { value: "VIP 5450 Z LPR", label: "VIP 5450 Z LPR", category: "LPR Camera", photo: "" },
        { value: "SS 3510 MF", label: "SS 3510 MF", category: "Face Terminal", photo: "" },
    ],
    AVICAM: [],
    MILESIGHT: [],
    UNIFI: [
        { value: "UVC-G4-PRO", label: "UVC-G4-PRO", category: "Camera", photo: "" },
        { value: "UVC-AI-PRO", label: "UVC-AI-PRO", category: "Camera", photo: "" },
    ],
    UNIVIEW: [
        { value: "IPC6222ER-X20P-VG", label: "IPC6222ER-X20P-VG", category: "LPR Camera", photo: "" },
    ],
} as const;

// Brand logos
export const BRAND_LOGOS: Record<string, string> = {
    HIKVISION: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Hikvision_logo.svg/2560px-Hikvision_logo.svg.png",
    AKUVOX: "https://www.akuvox.com/images/logo.png",
    DAHUA: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Dahua_Technology_logo.svg/2560px-Dahua_Technology_logo.svg.png",
    ZKTECO: "https://www.zkteco.com/static/img/logo.png",
    AXIS: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Axis_Communications_logo.svg/2560px-Axis_Communications_logo.svg.png",
    INTELBRAS: "https://www.intelbras.com/sites/default/files/2021-09/logo-intelbras.png",
    AVICAM: "",
    MILESIGHT: "",
    UNIFI: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Ubiquiti_Networks_Logo.svg/2560px-Ubiquiti_Networks_Logo.svg.png",
    UNIVIEW: "",
};

export type DeviceBrand = keyof typeof DRIVER_MODELS;

export function getModelsForBrand(brand: DeviceBrand) {
    return DRIVER_MODELS[brand] || [];
}

export function getBrandLogo(brand: string): string {
    return BRAND_LOGOS[brand.toUpperCase()] || "";
}
