    async getFaceList(device: Device): Promise < any[] > {
    try {
        // Get all users from the device
        const usersResponse = await this.request("POST", "/api/user/get",
            { "target": "user", "action": "get", "data": { "offset": 0, "num": 10000 } },
            device
        );

        const users = usersResponse?.data?.item || [];

        console.log(`[Akuvox] Retrieved ${users.length} users from device ${device.name}`);

        // Map users to the format expected by DeviceMemoryDialog
        return users.map((user: any) => {
            const userId = user.ID || user.UserID;

            // CardCode comes directly in the user object (comma-separated if multiple)
            const cardCodes = user.CardCode ? user.CardCode.split(',').map((c: string) => c.trim()).filter(Boolean) : [];

            // Generate FaceUrl if user has face (Type 0)
            const hasFace = user.Type === '0';
            const faceUrl = hasFace ? `http://${device.ip}/api/face/get?ID=${userId}` : null;

            return {
                ID: userId,
                UserID: user.UserID || userId,
                Name: user.Name || `Usuario ${userId}`,
                PIN: user.PrivatePIN || null, // PrivatePIN is the correct field
                CardCode: cardCodes.length > 0 ? cardCodes.join(', ') : '',
                HasFace: hasFace,
                HasTag: cardCodes.length > 0,
                Tags: cardCodes,
                Type: user.Type,
                DoorNum: user.DoorNum,
                FaceUrl: faceUrl,
                Group: user.Group,
                Source: user.Source
            };
        });
    } catch(error: any) {
        console.error(`[Akuvox] Error getting face list:`, error.message);
        console.error(`[Akuvox] Device details:`, {
            ip: device.ip,
            username: device.username,
            authType: device.authType,
            hasPassword: !!device.password
        });

        if (error.response?.status === 401) {
            throw new Error(`Autenticación fallida. Verifica las credenciales del dispositivo (Usuario: ${device.username}, Auth: ${device.authType})`);
        }

        throw new Error(`No se pudo obtener la lista de usuarios del dispositivo: ${error.message}`);
    }
}
