function showAllProperties(obj) {
    const props = new Set();
    let currentObj = obj;

    do {
        Object.getOwnPropertyNames(currentObj).forEach(p => props.add(p));
    } while ((currentObj = Object.getPrototypeOf(currentObj)));

    return [...props];
}

module.exports = {
    showAllProperties,
};
