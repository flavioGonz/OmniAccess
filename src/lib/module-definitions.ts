// Module definitions - NOT a server file, can export constants and types

export type ModuleId = 'MODULE_LPR' | 'MODULE_FACE' | 'MODULE_QUEUE';

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
}

export const MODULE_DEFINITIONS: ModuleInfo[] = [
  {
    id: 'MODULE_LPR',
    name: 'OmniAccess LPR',
    description: 'License Plate Recognition',
    icon: '\u{1F697}',
    defaultEnabled: true,
  },
  {
    id: 'MODULE_FACE',
    name: 'OmniAccess Face',
    description: 'Reconocimiento facial y control de acceso',
    icon: '\u{1F9D1}',
    defaultEnabled: true,
  },
  {
    id: 'MODULE_QUEUE',
    name: 'Control de Filas',
    description: 'Monitoreo de filas y tiempos de espera',
    icon: '\u{1F465}',
    defaultEnabled: false,
  },
];
