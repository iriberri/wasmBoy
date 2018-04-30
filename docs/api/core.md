**This is a WIP, the current Core / Lib does not implement this. This is a design doc on the final core that is planned to be implemented.**

[WasmBoy Memory Map](https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0)

This API Design is inspired by libraries such as [libretro](https://www.libretro.com/index.php/develop/), and the act of grabbing a gameboy, putting in the cartridge, and flipping the power switch 😊.

The Wasmboy Core API represents the [`exports`](https://developer.mozilla.org/en-US/docs/WebAssembly/Exported_functions) object of a wasm instance. This API Doc is useful for implementing your own JS library (see the lib API), or using the core as an application outside of the context of Javascript, [such as wasmboy-rs](https://github.com/CryZe/wasmboy-rs).

For an active implementation of the core as a lib, can be found [in the lib/ directory of the project](https://github.com/torch2424/wasmBoy/tree/master/lib).

Lastly, the core [currently supports up to MBC5 ROMs](http://gbdev.gg8.se/wiki/articles/Memory_Bank_Controllers). Which should emulate most Gameboy games.

# Table of Contents

* [Getting Started](#getting-started)
* [Complete API](#complete-api)
  * [Functions](#functions)
    * [config](#config)
    * [executeFrame](#executeframe)
    * [getNumberOfSamplesInAudioBuffer](#getnumberofsamplesinaudiobuffer)
    * [clearAudioBuffer](#clearaudiobuffer)
    * [setJoypadState](#setjoypadstate)
    * [saveState](#savestate)
    * [loadState](#loadstate)
  * [Memory Constants](#memory-constants)

# Getting Started

Here as a quick example of using the core, and how this would work out in the context of Javascript.

First, we need to instantiate our wasm module, and get a reference to our memory. The core will [`grow`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory/grow) it's memory to the appropriate size as needed.

**Instantiating the module:**

```javascript

// Some Other Code here

WebAssembly.instantiate(binary, {}).then((instantiatedWasm) => {

  // Get the Instance our our wasm Module
  const instance = instantiatedWasm.instance;
  const module = instantiatedWasm.module;

  // Get the wasm instance memory as an Unsigned int 8 Array. This is helpful as recognizing every element as a byte in memory.
  const wasmByteMemory = new Uint8Array(instance.exports.memory.buffer);
});
```

Now that we have our instantiated wasm, and it's memory, we should load in a game (ROM)! As we said before, we represented our memory as bytes (unsigned, 8 bit), and that is how we should load in the file. The instance exports many constant variables, describing its memory layout. Using `exports.CARTRIDGE_ROM_LOCATION`, we are going to find where we need to load our rom, and fill the designated section of memory. Similar to inserting a cartridge 💾. If you would also like to enabled running the gameboy boot ROM in the next step, follow this same process with your boot rom file, and using `exports.BOOT_ROM_LOCATION`. If you know about Gameboy hardware, you know that the Boot Rom is replaced in memory by the gameboy once the program counter hits '0x100', this is handled for you by the core memory map implementation.

```javascript
// Assume we bound the 'instance' variable to this. Meaning this.wasmInstance = instantiatedWasm.instance.
// Assume we bound the 'wasmByteMemory' variable to this. Meaning this.wasmByteMemory = wasmByteMemory.

// Pretend we got an Array Buffer using the File Reader API
// https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
const gameRomFileAsArrayBuffer = fileAsArrayBuffer;

// Load the game data into actual memory
for(let i = 0; i < gameRomFileAsArrayBuffer.length; i++) {
  if (gameRomFileAsArrayBuffer[i]) {
    this.wasmByteMemory[this.wasmInstance.exports.CARTRIDGE_ROM_LOCATION + i] = gameRomFileAsArrayBuffer[i];
  }
}

```

Next, Preparing the emulator only takes one step, `.config()`. This will configure the emulator for the context provided. This will do things like set the CPU to the correct Program counter position, and load initial values into the state of the emulator memory. Since Wasm and JS can only pass numbers back and forth, config takes in many properties for the options of the emulator. However, we only need to know truthy vs. falsey values. Therefore, we pass in 1 for true, and 0 for false.

```javascript

// Assume we bound the 'instance' variable to this. Meaning this.wasmInstance = instantiatedWasm.instance.
// We are using terenary statements to return our true (1) or false (0) values

// We are going to set enableBootmRom to false, simply because we did not in the previous step of the quick start
// Enable this if you did place the boot ROM bytes in the BOOT_ROM_LOCATION.
const enabledBootRom = false;

// Assume all other variables were configured to your liking.

this.wasmInstance.exports.config(
  enableBootRom ? 1 : 0, // If you plan to load a boot rom, and handle unloading it
  preferGbc ? 1 : 0, // Some Gameboy Games allow both Gameboy and Gameboy Color. Set to 1 if you want to play these games in color. Set to 0 to play these games without
  audioBatchProcessing ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.graphicsBatchProcessing ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.timersBatchProcessing ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.graphicsDisableScanlineRendering ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.audioAccumulateSamples ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.tileRendering ? 1 : 0, // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
  this.tileCaching ? 1 : 0 // See https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md
)
```

Now that are emulator has a ROM loaded, and it is configured for the current settings, we can start running the game! The core runs frame-by-frame. Meaning, We will continually run the following steps:

1. Check if we are running too fast, if we should wait for Audio Latency
2. Ask the core to run a frame, and check it's response.
3. Update our means of outputting Graphics.
4. Update our means of outputting Audio.
5. Go Back to Step 1. ♻️

Step 1 involves the exported functions: `getNumberOfSamplesInAudioBuffer()` and `clearAudioBuffer()`. Since the core can output samples faster than the audio can play, you will probably want to manage your latency, and not run a few frames to allow your audio output to catch up with the core. Step 2 involves the exported functions: `executeFrame()`. executeFrame will return an integer, where the integer value represents the current status of the emulator. `-1` represents there was an error in the core, all execution should stop, and be investigated in the debugger. `0` represents the frame executed successfully, no further action is required.

For this example, we will use [setInterval](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setInterval) at 16ms (1000ms / 16ms = 60fps), but you may want to implement more similar to a [guide by MDN on implementing web games](https://developer.mozilla.org/en-US/docs/Games/Anatomy).


```javascript

setInterval(() => {

  // Check if we are too far ahead our audio
  // Pretend we don't want more than 6000 samples in the buffer at a time
  // See the WasmBoy 'lib' for a complete example
  if (this.wasmInstance.exports.getNumberOfSamplesInAudioBuffer() > 6000) {
    return;
  }

  // Assume we bound the 'instance' variable to this. Meaning this.wasmInstance = instantiatedWasm.instance.
  const response = this.wasmInstance.exports.executeFrame();

  if (response > 0) {
    // See Below for Update Graphics
    renderGraphics()

    // See Below for Play Audio
    playAudio()

    // See Below for Set Joypad Input
    setJoypadInput()
  } else {
    // Stop All Execution
    throw new Error('WasmBoy Core Error!');
  }
}, 16);
```

Now that the core is running, we need to represent its output! We'll start with our graphics, which expands upon the `renderGraphics()` function mentioned above. The core outputs the original gameboy width and height (160x144). Where each pixel is represented in 3 bytes (Red, Green, Blue). This is organized in a 2D array (x, y), but since the memory is 1 dimensional, it represents the 2d array in as a 1d array. For Example, pixel 0,0 is at `exports.FRAME_LOCATION`. pixel 1, 0 is at `exports.FRAME_LOCATION + 3`. pixel 0,1 is at `exports.FRAME_LOCATION + (160 * 3)`. I use the following function to find where each pixel is on the 160x144 map in memory:

```javascript
const getRgbPixelStart = (x, y) => {
  this.wasmInstance.exports.FRAME_LOCATION + (((y * 160) + x) * 3);
}
```

Now that we know how to grab every pixel in memory, we can finally output this to our choice. For instance, in the [shared test functions](https://github.com/torch2424/wasmBoy/blob/master/test/common-test.js), I use the npm package [pngjs-image](https://www.npmjs.com/package/pngjs-image) to create a png (screenshot) of what is currently in the video memory.

P.S If you are interested in outputting things such as Tile Data in memory and the entire 256x256 background map, see the [Preact Components in the WasmBoy Debugger](https://github.com/torch2424/wasmBoy/tree/master/debugger/wasmboyDebugger)

Also, we need to represent our core audio. This expands upon the `playAudio()` function mentioned above. The core will output raw PCM samples as unsigned bytes to the `AUDIO_BUFFER_LOCATION`. So in the context of [AudioBuffers in the Web](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer), the unsigned byte values of: 255 would represent `1.0`, 0 would represent `-1.0`, and 128 would represent `0.0`. However, each sample has a left and right channel. So for example, the first sample would be located at `AUDIO_BUFFER_LOCATION + 0` and `AUDIO_BUFFER_LOCATION + 1`, the second sample would be located at `AUDIO_BUFFER_LOCATION + 2` and `AUDIO_BUFFER_LOCATION + 3`, and so on... This means that, if getNumberOfSamplesInAudioBuffer() returns 1, it means that you would need to extract both `AUDIO_BUFFER_LOCATION + 0` and `AUDIO_BUFFER_LOCATION + 1`. The buffer gets filled as frames are executed, and the current size of the buffer is returned by `exports.getNumberOfSamplesInAudioBuffer()`. After you grab the samples and play them, you must clear the buffer with `exports.clearAudioBuffer()`. After clearing the buffer, the number of samples in buffer is reset to 0, and the old samples will be overwritten. Please see the [audio implementation in the JS lib](https://github.com/torch2424/wasmBoy/blob/master/lib/audio/audio.js) for how this is done in the context of javascript.

Awesome! We finally got the core running, with graphical and audio output! But how do we control the game? This expands upon the `setJoypadInput()` function mentioned above. Passing the state of the gameboy controller is done with the exported function `setJoypadState()`. For a full example of passing input to the wasmboy core see [the JS lib controller implementation](https://github.com/torch2424/wasmBoy/blob/master/lib/controller/controller.js). Each button state (Up, Down, A, B, etc..) takes in a value of `1` for that it is currently being pressed, or `0` for if it is not pressed. Here is an example using booleans in the context of ternary statements, to set our joypad state:

```javascript

// Assume we bound the 'instance' variable to this. Meaning this.wasmInstance = instantiatedWasm.instance.

this.wasmInstance.exports.setJoypadState(
  controllerState.UP ? 1 : 0,
  controllerState.RIGHT ? 1 : 0,
  controllerState.DOWN ? 1 : 0,
  controllerState.LEFT ? 1 : 0,
  controllerState.A ? 1 : 0,
  controllerState.B ? 1 : 0,
  controllerState.SELECT ? 1 : 0,
  controllerState.START ? 1 : 0
);
```

You now have a working library for the WasmBoy core! Congrats! Thanks for going on this Journey with me 🙏Lastly, you may want to reset, or load new games! First, clear the memory by writing zeros over the entire WasmBoy memory. And then simply re-do all the steps mentioned in this "Getting Started".

**Bonus (Save States):** Save States can be done by calling the function `exports.saveState()`, and then backing up the memory specified by `WASMBOY_STATE_LOCATION` and `WASMBOY_STATE_SIZE`, `GAMEBOY_INTERNAL_MEMORY_LOCATION` and `GAMEBOY_INTERNAL_MEMORY_SIZE`, `CARTRIDGE_RAM_LOCATION` and `CARTRIDGE_RAM_SIZE`, and `GBC_PALETTE_LOCATION` and `GBC_PALETTE_SIZE`. Loading the state is done by instantiating the module, loading the game, configuring, and then loading these sections of memory back into the emulator, calling, `exports.loadState()` and continuing as usual. Save States are per ROM. I identify ROMs using the [cartridge header](http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header), though doing something like making SHA1 hashes of the rom would also work. See the [memory.js of the lib](https://github.com/torch2424/wasmBoy/blob/master/lib/memory/memory.js) for a save state implementation in JS.

# Complete API

This represents the complete API for the core, and includes all the individual public facing exports.

## Functions

These are the functions used to implement a library on top of the core for standard usage. **Note:** Other functions used for debugging purposes. such as `getProgramCounter()` will be documented in the future, but the plan is to consolidate these into a single file that can be referenced 😄 .

### config

```
config(
  enableBootRom: i32 = 0,
  preferGbc: i32 = 1,
  audioBatchProcessing: i32 = 0,
  graphicsBatchProcessing: i32 = 0,
  timersBatchProcessing: i32 = 0,
  graphicsDisableScanlineRendering: i32 = 0,
  audioAccumulateSamples: i32 = 0,
  tileRendering: i32 = 0,
  tileCaching: i32 = 0
): void
```

This function takes in i32 as booleans, where 1 represents true, 0 represents false. This will configure the core to the passed in configuration, and reset the emulator state. This should be used when initially using the core, when something in the configuration should change, or when you need to reset the emulator. In the case of resetting, we suggest passing in the previous configuration, or else the configuration will be cleared back to the default. **This function must be called before using the core**.

### executeFrame

```
executeFrame(): i32
```

This function has no input, but returns an integer that represents a response code. The response codes are:

* `-1` - The core has broken. The core incorrectly emulated the game and encountered an error. The use should be notified, and it would be advised to open an issue on WasmBoy for the game with the error.

* `0` - The frame was executed correctly! Audio, Graphics, and Controller input should be updated before the next frame is executed.

### getNumberOfSamplesInAudioBuffer

```
getNumberOfSamplesInAudioBuffer(): i32
```

This function returns the number of samples in the audio buffer. These raw PCM audio samples should be passed to your means of outputting audio, and then cleared with `clearAudioBuffer()` so that new samples can be placed into the buffer. Each sample has a left and right channel. So for example, the first sample would be located at `AUDIO_BUFFER_LOCATION + 0` and `AUDIO_BUFFER_LOCATION + 1`, the second sample would be located at `AUDIO_BUFFER_LOCATION + 2` and `AUDIO_BUFFER_LOCATION + 3`, and so on... This means that, if getNumberOfSamplesInAudioBuffer() returns 1, it means that you would need to extract both `AUDIO_BUFFER_LOCATION + 0` and `AUDIO_BUFFER_LOCATION + 1`.

### clearAudioBuffer

```
clearAudioBuffer(): void
```

This function simply resets the amount of samples in the audio buffer, so that `getNumberOfSamplesInAudioBuffer()` would return 0. The core will then overwrite any old samples, for the next time you grab samples from the buffer.

### setJoypadState

```
setJoypadState(
  controllerState.UP ? 1 : 0,
  controllerState.RIGHT ? 1 : 0,
  controllerState.DOWN ? 1 : 0,
  controllerState.LEFT ? 1 : 0,
  controllerState.A ? 1 : 0,
  controllerState.B ? 1 : 0,
  controllerState.SELECT ? 1 : 0,
  controllerState.START ? 1 : 0
): void
```

This function takes in `1` for pressed, and `0` for released, in the order described above, for each button on the gameboy Joypad. The state of the controller should be set in between frames to allow the user to control the currently running ROM.

### saveState

```
saveState(): void
```

This function writes the state of internal in-memory WasmBoy variables to `WASMBOY_STATE_LOCATION`. This is used, in part with a few other steps, to performa save states of the core.

### loadState

```
loadState(): void
```
This function loads the state written to `WASMBOY_STATE_LOCATION` to set the internal in-memory WasmBoy variables. This is used, in part with a few other steps, to perform a loading a state of the core.

## Memory Constants

These are the constants that represent the size and location of every partition of memory in the [WasmBoy Memory Map](https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0). Each exported memory map constant has a size and a location. And each exported memory map constants will be represented by `MEMORY_MAP_CONSTANT_NAME_X`. Where `MEMORY_MAP_CONSTANT_NAME_` is the name of the constant described below, and `X` represents the text `LOCATION` and `SIZE`, to return each respectively. For example, at this time or writing, the cartridge RAM is located at `0x0CFC00`, and has a size of `8MB` (`0x800000`). Therefore this is represented below by `CARTRIDGE_ROM_X`, where `CARTRIDGE_ROM_LOCATION` would return `0x0CFC00`, and `CARTRIDGE_ROM_SIZE` would return `0x800000`.

* `WASMBOY_MEMORY_X` - The size and location of the entire WasmBoy memory map (location will most likely always be 0x0).

* `ASSEMBLYSCRIPT_MEMORY_X` - (Assemblyscript uses a HEAP)[https://github.com/AssemblyScript/assemblyscript/wiki/Memory-Layout-&-Management] for things like strings and arrays. Therefore, we provide some memory for this.

* `WASMBOY_STATE_X` - In order to provide save states, we need to be able to store the values of some internal values of the emulator. Therefore, this section of memory is used for that.

* `GAMEBOY_INTERNAL_MEMORY_X` - After the cartridge memory locations, the gameboy has memory mappings for video, audio, echo, etc.. This represents that memory, though the individual section are represented as well below. Also, please note, the only exception is that the cartridge ram is **NOT** represented in this memory, and has it's own section in the memory map. It may help to see [the actual gameboy memory map](http://gameboy.mongenel.com/dmg/asmmemmap.html) for reference.

* `VIDEO_RAM_X` - This represents both banks of the video ram for the Gameboy.

* `WORK_RAM_X` - This represents all banks for the work ram of the Gameboy.

* `OTHER_GAMEBOY_INTERNAL_MEMORY` - This is the other Gameboy internal memory that is not the video or work ram.

* `VIDEO_OUTPUT_X` - This represents all sections of memory that involve the output of frames, internal sections of memory for the core to store things, debugging output for tile data, etc.. as RGB 2d arrays. With the exeception of the Gameboy Color palettes, and the priority map.

* `GBC_PALETTE_X` - This is where the Gameboy Color palettes are stored for the core to add color to Gameboy tiles. This will most likely not be used by any libraries.

* `BG_PRIORITY_MAP_X` - This is an internal section of memory used for Sprite / BG priority as we draw the individual layers of the frame output. This will most likely not be used by any libraries.

* `FRAME_X` - This is the RGB representation of the current 160x144 Frame of the Gameboy. This is overwrriten between calls to `executeFrame()`.

* `BACKGROUND_MAP_X` - This is the current 256x256 background map that the Gameboy scrolls across. This should be used only for debuggers. See the [wasmboy debugger implementation](https://github.com/torch2424/wasmBoy/blob/master/debugger/wasmboyDebugger/wasmboyBackgroundMap/wasmboyBackgroundMap.js)

* `TILE_DATA_X` - This is the current tiledata for the gameboy. See the [wasmboy debugger implementation](https://github.com/torch2424/wasmBoy/blob/master/debugger/wasmboyDebugger/wasmboyTileData/wasmboyTileData.js)

* `OAM_TILES_X` - This is the current OAM Tiles (sprites) that are being shown on the display at the time, organized by 0 top 40. These assume 8x16 tiles, where if the game is 8x8, the bottom tile will simply be empty.

* `AUDIO_BUFFER_X` - This is where the raw PCM samples are stored for audio output.

* `CARTRIDGE_RAM_X` - This is where the Cartridge RAM banks are stored and mapped for the core. To emulate in game saves, this should be backed up before unloading the library 💾 .

* `CARTRIDGE_ROM_X` - This is where the Cartridge ROM banks are stored and mapped for the core.
