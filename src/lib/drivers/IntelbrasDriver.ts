import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";

export class IntelbrasDriver implements IDeviceDriver {
    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Intelbras] Syncing credential ${credential.value} to ${device.ip} (Stub)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[Intelbras] Triggering relay on ${device.ip} (Stub)`);
    }
}
