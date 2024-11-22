

// Function to clear all properties of an object
function clearObject(obj) {
    // Iterate over the keys and delete each property
    Object.keys(obj).forEach(key => {
        delete obj[key];
    });
}

// Clear the properties of the constant object
module.exports = {
    clearObject,
};
