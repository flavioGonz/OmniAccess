import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";

export class DahuaDriver implements IDeviceDriver {
    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Dahua] Syncing credential ${credential.value} to ${device.ip} (Stub)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[Dahua] Triggering relay on ${device.ip} (Stub)`);
    }
}
