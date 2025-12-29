import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";

export class ZKTecoDriver implements IDeviceDriver {
    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[ZKTeco] Syncing credential ${credential.value} to ${device.ip} (Stub)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[ZKTeco] Triggering relay on ${device.ip} (Stub)`);
    }
}
