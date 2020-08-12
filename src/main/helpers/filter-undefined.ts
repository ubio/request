// delete undefined properties from object
export function filterUndefined(obj: { [k: string]: any }) {
    const filtered = {} as any;
    for(const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
            filtered[k] = v;
        }
    }

    return filtered;
}
