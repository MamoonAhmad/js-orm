





export const isSingleObject = (ioObjects: any) => {
    if(!Array.isArray(ioObjects) || ioObjects.length === 1) {
        return Array.isArray(ioObjects) ? ioObjects[0] : ioObjects
    }
    return null
}


