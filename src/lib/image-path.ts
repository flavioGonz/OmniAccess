export const getImagePath = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    // Normalize: remove leading slash to check prefix
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    if (cleanPath.startsWith('api/files/')) {
        return `/${cleanPath}`;
    }

    return `/api/files/${cleanPath}`;
};
