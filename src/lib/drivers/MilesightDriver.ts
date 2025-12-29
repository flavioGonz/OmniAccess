import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";

export class MilesightDriver implements IDeviceDriver {
    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Milesight] Syncing credential ${credential.value} to ${device.ip} (Stub)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[Milesight] Triggering relay on ${device.ip} (Stub)`);
    }
}
