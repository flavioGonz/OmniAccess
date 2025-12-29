import { Device, Credential } from "@prisma/client";

export interface IDeviceDriver {
  upsertCredential(credential: Credential, device: Device): Promise<void>;
  triggerRelay(device: Device): Promise<void>;
}
