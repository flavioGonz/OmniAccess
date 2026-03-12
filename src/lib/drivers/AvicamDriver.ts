import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential } from "@prisma/client";
import axios from "axios";

export class AvicamDriver implements IDeviceDriver {
    private async request(method: "GET" | "POST", path: string, data: any, device: Device): Promise<any> {
        const url = `${this.getBaseUrl(device)}${path}`;
        console.log(`[Avicam Web API] ${method} ${url}`);
        // This is a placeholder for actual API implementation
        return { success: true };
    }

    public getBaseUrl(device: Device): string {
        return `http://${device.ip}`;
    }

    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Avicam] Syncing credential ${credential.value} to ${device.ip} (Stub - Pending API Docs)`);
    }

    async triggerRelay(device: Device): Promise<void> {
        console.log(`[Avicam] Triggering relay on ${device.ip} (Stub - Pending API Docs)`);
        // Traditional face terminals often use /api/relay/trig or similar
        // await this.request("POST", "/api/relay/trig", { action: "open" }, device);
    }

    async syncUserWithFace(user: any, device: Device): Promise<void> {
        console.log(`[Avicam] Syncing user ${user.name} with face to ${device.ip} (Stub)`);
    }
}
