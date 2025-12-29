import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";

export class AvicamDriver implements IDeviceDriver {
    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Avicam] Syncing credential ${credential.value} to ${device.ip} (Stub)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[Avicam] Triggering relay on ${device.ip} (Stub)`);
    }
}
