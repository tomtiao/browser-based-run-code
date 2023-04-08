// Assume add.wasm file exists that contains a single function adding 2 provided arguments
const fs = require('fs');

const wasmBuffer = fs.readFileSync(process.argv[2]);
WebAssembly.instantiate(wasmBuffer, {}).then(wasmModule => {
    console.dir(wasmModule)
}).catch(err => {
    debugger

});