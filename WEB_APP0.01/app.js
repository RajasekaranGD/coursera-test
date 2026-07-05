/* =======================================================
   MODULE 1: CONFIGURATION & STATE
   Stores all the settings and variables we need globally.
   ======================================================= */
// ⚠️ REPLACE THESE WITH THE UUIDS FROM YOUR ESP32 CODE
const BLE_CONFIG = {
    name: "SCLSC_V2_Machine",
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    rx:      "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // Phone -> ESP32
    tx:      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // ESP32 -> Phone
};

let bleDevice = null;
let rxCharacteristic = null;

/* =======================================================
   MODULE 2: BLE CONNECTION MANAGER
   Handles connecting and disconnecting from the ESP32.
   ======================================================= */
async function connectBLE() {
    try {
        console.log("Requesting Bluetooth Device...");
        
        // 1. Ask browser to open pairing menu
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: BLE_CONFIG.name }],
            optionalServices: [BLE_CONFIG.service]
        });

        // 2. Add listener for if the machine goes out of range
        bleDevice.addEventListener('gattserverdisconnected', handleDisconnectEvent);

        // 3. Connect to the GATT Server
        console.log("Connecting to GATT Server...");
        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService(BLE_CONFIG.service);
        
        // 4. Get the specific communication channels (UUIDs)
        rxCharacteristic = await service.getCharacteristic(BLE_CONFIG.rx);
        const txCharacteristic = await service.getCharacteristic(BLE_CONFIG.tx);
        
        // 5. Tell the browser to listen for data from the ESP32
        await txCharacteristic.startNotifications();
        console.log("Notifications started!"); 

        // ⚠️ ADD THIS: Small delay to let Windows Bluetooth stack stabilize
        await new Promise(r => setTimeout(r, 500));


        txCharacteristic.addEventListener('characteristicvaluechanged', parseIncomingJSON);

        // 6. Change the buttons and colors on the screen
        ui_SetConnectedState(true);

        // 7. 🔥 Send our first JSON command: Wake up the telemetry!
        sendJSONCommand({ "cmd": "stream", "state": 1 });

    } catch (error) {
        console.error("Connection failed!", error);
        alert("Connection Failed: " + error);
    }
}

function disconnectBLE() {
    if (bleDevice && bleDevice.gatt.connected) {
        console.log("Manual disconnect triggered.");
        
        // Tell the ESP32 to stop wasting power sending data
        sendJSONCommand({ "cmd": "stream", "state": 0 });
        
        // Wait 100ms for the command to send, then cut the connection
        setTimeout(() => {
            bleDevice.gatt.disconnect();
        }, 100);
    }
}

function handleDisconnectEvent() {
    console.log("Device disconnected.");
    bleDevice = null;
    rxCharacteristic = null;
    ui_SetConnectedState(false); // Changes UI back to red/disconnected
}

/* =======================================================
   MODULE 3: DATA PARSER (ESP32 -> WEB)
   Catches data from ESP32, decodes it, and sends it to UI.
   ======================================================= */
function parseIncomingJSON(event) {
    // 1. Get the raw bytes from the BLE notification
    const value = event.target.value;
    
    // 2. Decode the bytes into a string
    const jsonString = new TextDecoder('utf-8').decode(value);
    
    // 🔥 DEBUG: Log the raw string to the browser console every time!
    console.log("Raw Data Received: ", jsonString);

    try {
        // Convert text string into a usable Javascript Object
        const data = JSON.parse(jsonString); 
        
        // Check the "type" tag from our ESP32 C++ code
        if (data.type === "tel") {
            ui_UpdateTelemetry(data);
        } 
        else if (data.type === "cfg") {
            console.log("Received Config:", data);
            // We will add code here later to populate the settings menu!
        }

    } catch (e) {
        console.log("Ignored broken JSON string: ", jsonString);
    }
}

/* =======================================================
   MODULE 4: COMMAND SENDER (WEB -> ESP32)
   Packages commands into JSON and fires them to the ESP32.
   ======================================================= */
async function sendJSONCommand(jsonObj) {
    if (!rxCharacteristic) {
        console.warn("Cannot send command, BLE not connected.");
        return;
    }
    try {
        // Convert the Javascript Object into a Text String
        const jsonString = JSON.stringify(jsonObj); 
        // Convert the Text String into raw bytes and send
        await rxCharacteristic.writeValue(new TextEncoder('utf-8').encode(jsonString));
        console.log("Command Sent: ", jsonString);
    } catch (error) {
        console.error("Failed to send command: ", error);
    }
}

/* =======================================================
   MODULE 5: UI UPDATER
   The only part of the code allowed to touch the HTML elements.
   ======================================================= */
function ui_SetConnectedState(isConnected) {
    if (isConnected) {
        // Add the 'connected' CSS class to make the dot green
        document.getElementById("statusDot").classList.add("connected");
        document.getElementById("statusText").innerText = "Online";
        
        // Hide connect button, show disconnect button
        document.getElementById("connectBtn").style.display = "none";
        document.getElementById("disconnectBtn").style.display = "block";
    } else {
        // Remove the 'connected' CSS class to make the dot red
        document.getElementById("statusDot").classList.remove("connected");
        document.getElementById("statusText").innerText = "Disconnected";
        
        // Show connect button, hide disconnect button
        document.getElementById("connectBtn").style.display = "block";
        document.getElementById("disconnectBtn").style.display = "none";
        
        // Zero out the dials for safety
        document.getElementById("val_w_act").innerText = "0.0";
        document.getElementById("val_f_act").innerText = "0.0";
    }
}

function ui_UpdateTelemetry(data) {
    // Only update elements if the ESP32 actually sent that piece of data
    // toFixed(1) ensures it always shows one decimal place (e.g. 150.0)
    
    if (data.w_act !== undefined) document.getElementById("val_w_act").innerText = data.w_act.toFixed(1);
    if (data.w_set !== undefined) document.getElementById("val_w_set").innerText = data.w_set.toFixed(1);
    
    if (data.f_act !== undefined) document.getElementById("val_f_act").innerText = data.f_act.toFixed(1);
    if (data.f_set !== undefined) document.getElementById("val_f_set").innerText = data.f_set.toFixed(1);
}