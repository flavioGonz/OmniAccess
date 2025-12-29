import { prisma } from "../lib/prisma";
import { DeviceBrand } from "@prisma/client";
import { HikvisionDriver } from "../lib/drivers/HikvisionDriver";
import { AkuvoxDriver } from "../lib/drivers/AkuvoxDriver";
import { IntelbrasDriver } from "../lib/drivers/IntelbrasDriver";
import { DahuaDriver } from "../lib/drivers/DahuaDriver";
import { ZKTecoDriver } from "../lib/drivers/ZKTecoDriver";
import { AvicamDriver } from "../lib/drivers/AvicamDriver";
import { MilesightDriver } from "../lib/drivers/MilesightDriver";
import { UnifiDriver } from "../lib/drivers/UnifiDriver";
import { UniviewDriver } from "../lib/drivers/UniviewDriver";
import { IDeviceDriver } from "../lib/drivers/IDeviceDriver";

const hikvisionDriver = new HikvisionDriver();
const akuvoxDriver = new AkuvoxDriver();
const intelbrasDriver = new IntelbrasDriver();
const dahuaDriver = new DahuaDriver();
const zktecoDriver = new ZKTecoDriver();
const avicamDriver = new AvicamDriver();
const milesightDriver = new MilesightDriver();
const unifiDriver = new UnifiDriver();
const univiewDriver = new UniviewDriver();

function getDriver(brand: DeviceBrand): IDeviceDriver {
    switch (brand) {
        case DeviceBrand.HIKVISION:
            return hikvisionDriver;
        case DeviceBrand.AKUVOX:
            return akuvoxDriver;
        case DeviceBrand.INTELBRAS:
            return intelbrasDriver;
        case DeviceBrand.DAHUA:
            return dahuaDriver;
        case DeviceBrand.ZKTECO:
            return zktecoDriver;
        case DeviceBrand.AVICAM:
            return avicamDriver;
        case DeviceBrand.MILESIGHT:
            return milesightDriver;
        case DeviceBrand.UNIFI:
            return unifiDriver;
        case DeviceBrand.UNIVIEW:
            return univiewDriver;
        default:
            throw new Error(`Unsupported device brand: ${brand}`);
    }
}

export async function syncToDevices(credentialId: string) {
    try {
        const credential = await prisma.credential.findUnique({
            where: { id: credentialId },
            include: {
                user: {
                    include: {
                        accessGroups: {
                            include: {
                                devices: true,
                            },
                        },
                    },
                },
            },
        });

        if (!credential || !credential.user) {
            console.warn(`Credential ${credentialId} not found or has no user.`);
            return;
        }

        // Generic type for device map
        const devicesMap = new Map<string, any>();

        // Collect all unique devices from all access groups
        for (const group of credential.user.accessGroups) {
            for (const device of group.devices) {
                devicesMap.set(device.id, device); // Use Map to dedup by ID
            }
        }

        const devices = Array.from(devicesMap.values());

        console.log(`Syncing credential ${credential.id} (${credential.value}) to ${devices.length} devices...`);

        const promises = devices.map(async (device) => {
            try {
                const driver = getDriver(device.brand);
                await driver.upsertCredential(credential, device);
                console.log(`Synced to ${device.brand} ${device.ip}`);
            } catch (error: any) {
                console.error(`Error syncing to ${device.ip}:`, error.message);
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error("LiveSync Error:", error);
    }
}
