**This is a WIP, the current Core / Lib does not implement this. This is a design doc on the final lib that is planned to be implemented.**

This is the API Design for the WasmBoy lib. Meaning, if you are making an app in Javascript in something like React, a hybrid app in something like Ionic, or even a headless Node app, this is what you would want to use. This offers an easy to use API to get playing gameboy games in the browser, without having to handle running and outputting the game from the core yourself.

# Table of Contents

* [Getting Started](#getting-started)
* [Complete API](#complete-api)
  * [Functions](#functions)
  * [config](#config)
  * [loadROM](#loadrom)
  * [play](#play)
  * [pause](#pause)
  * [saveState](#savestate)
  * [getSaveStates](#getsavestates)
  * [loadState](#loadstate)
  * [enableDefaultJoypad](#enabledefaultjoypad)
  * [disableDefaultJoypad](#disabledefaultjoypad)
  * [setJoypadState](#setjoypadstate)
  * [addTouchInput](#addtouchinput)
* [Object Schema](#object-schema)
  * [WasmBoyOptions](#wasmboyoptions)
  * [Save State](#save-state)
  * [Joypad State](#joypad-state)

# Getting Started

First, you will need to install the WasmBoy into your project.

**npm**: `npm install --save wasmboy`

**github**: `npm install --save https://github.com/torch2424/wasmBoy.git`

Then, you would want to import it into your JS file. This can be done with either Node's `require()` or [ES6 imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import).

**require()**:  `const WasmBoy = require('wasmboy')`

**import**: `import { WasmBoy } from 'wasmboy'`

Now that we have the wasmboy Object, let's take a step back and understand some patterns of the lib:

1. The `WasmBoy` object is a **singleton**. Meaning, that it returns a single, and the same, instance of WasmBoy across your application.

2. The lib is promise based, meaning almost every function in the lib will return a promise. This allows freedom for us to add asynchronous code where we can without worrying about breaking things in the future, and this makes it more consistent for our end-users :smile:.

 Next, we need to configure the WasmBoy object. To configure the WasmBoy Object, you must run the function `configure` with the WasmBoyOptions Object, and an output canvas element. The `WasmBoyOptions` object is covered in more detail in the "Complete API", where it describes each option, and it's effects (The callbacks allow for especially cool things). Here is an example using the some default settings for running on mobile:

```javascript

// Get our HTML5 Canvas element
const canvasElement = document.querySelector('canvas');

const WasmBoyOptions = {
  headless: false,
  useGbcWhenOptional: true,
	isAudioEnabled: true,
	frameSkip: 1,
	audioBatchProcessing: true,
	timersBatchProcessing: false,
	audioAccumulateSamples: true,
	graphicsBatchProcessing: false,
	graphicsDisableScanlineRendering: false,
	tileRendering: true,
	tileCaching: true,
	gameboyFPSCap: 60,
  updateGraphicsCallback: false,
  updateAudioCallback: false,
  saveStateCallback: false
}

WasmBoy.configure(WasmBoyOptions, canvasElement).then(() => {
  console.log('WasmBoy is configured!');
  // You may now load games, or use other exported functions of the lib.
}).catch(() => {
  console.error('Error Configuring WasmBoy...');
});
```

**For the rest of the "Getting Started" guide we will assume WasmBoy was configured, and the following code was run in the .then() block**

Now, we can start loading ROMs into WasmBoy. WasmBoy accepts `.gb`, `.gbc`, and `.zip` files, where in the case of `.zip` files will just use the first found `.gb` or `.gbc` file. To load these file types, we will use the function `.loadROM(myROM)`. Where, `myRom` is either a:

1. URL that we can use [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to download the file.

2. A [file](https://developer.mozilla.org/en-US/docs/Web/API/File) object from something like an [input of type="file"](https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications).

3. A [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) of the bytes that make up the ROM.

Here is a quick example of the process:

```HTML
<input type="file" id="input" onchange="loadROM(event)">
```

```javascript
loadROM(event) {
  WasmBoy.loadROM(event.target.files[0]).then(() => {
    console.log('WasmBoy ROM loaded!');
  }).catch(() => {
    console.error('Error loading the ROM');
  });
}
```

Now that we have a ROM loaded, we can now play WasmBoy! Simply call `.play()` and you are good to go!

```javascript
WasmBoy.play().then(() => {
  console.log('WasmBoy is playing!');
}).catch(() => {
  console.error('WasmBoy had an error playing...');
});
```

To pause WasmBoy, simply call `.pause()`.

```javascript
WasmBoy.pause().then(() => {
  console.log('WasmBoy is paused!');
}).catch(() => {
  console.error('WasmBoy had an error pausing...');
});
```

Now that we can play and pause WasmBoy, the only thing left we would need to do for basic usage, is to allow resetting WasmBoy, with the same or a different game! But this entails multiple paths:

1. *"I want to reconfigure WasmBoy"*. Simply called `.config` again. **But, you will need to run `.loadROM(myROM)`** as well.

2. *"I want to keep the same configuration, but load a different ROM"*. Simply called `.loadROM(myROM)`, with the new ROM.

3. *"I want to keep my current configuration, and the same ROM"*. Simply called `.reset()`, for example:

```javascript
WasmBoy.reset().then(() => {
  console.log('WasmBoy is reset!');
}).catch(() => {
  console.error('WasmBoy had an error reseting...');
});
```

**NOTE:** calling `.reset()` pauses the game. To continue executing, simply call `.play()` in the `.then()` block.

Rad! We got the game playing, hooray! And you may notice, you can already play it! Even with Controllers! That is because WasmBoy uses the npm package [repsonsive-gamepad](https://www.npmjs.com/package/responsive-gamepad) for an all-in-one implementation of the GameBoy Joypad. However, you may want to add mobile controls, and this can be done with `.addTouchInput()`. Please see the package documentation, or the debugger / demo implementation, on how to do this. However, you may think that the package isn't doing quite what you want it to. If so, you can disable the default Joypad implementation with `.disableDefaultJoypad()`, but if you realize you want it back actually, you can use `.enableDefaultJoypad()`.

Finally, the last thing that you may want to do is, *allow in-game saves, and save and load states*. WasmBoy uses [indexedDb to allow for offline browser storage](https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa), and [localStorage to catch when the browser is closing](https://bugs.chromium.org/p/chromium/issues/detail?id=144862). Though, WasmBoy currently cannot [always catch when mobile browsers are unloading](https://github.com/torch2424/wasmBoy/issues/91), thus a solution is in the works for this, and for now, suggest mobile users save state often. Also, WasmBoy handles determining which ROM represents each individual gameboy game.

So now we know how it works under the hood, how do we implement this? Well, *for in-game saves, WasmBoy will automatically handle backing up the Cartridge RAM for you, thus this works out-of-the-box*. However, Save states require the function `.saveState()`. Please note, `.saveState()` will pause the game, thus `.play()` would need to be called in the `.then()` block to continue execution.

```javascript
WasmBoy.saveState().then(() => {
  console.log('WasmBoy saved the state!');
  // Call .play() here to continue playing the ROM.
}).catch(() => {
  console.error('WasmBoy had an error saving the state...');
});
```

Awesome! We saved the state! But how do we load it back? Oh wait, what if we saved like 100 states? How do we know which state to load? To get all saved states for the current loaded ROM, we can call `.getSaveStates()`. Which, in the `.then()` block, will return an array of all the save state objects.

```javascript
WasmBoy.getSaveStates().then((arrayOfSaveStateObjects) => {
  console.log('Got WasmBoy Save States for the loaded ROM: ', arrayOfSaveStateObjects);
}).catch(() => {
  console.error('Error getting the save states for the loaded ROM');
});
```

Now that we have all the save states. We can load a specific one. I suggest showing the options to the end user, and then using the function `loadState()`.  Please note, `.loadState()` will pause the game, thus `.play()` would need to be called in the `.then()` block to continue execution.

```javascript
WasmBoy.loadState(saveStateFromArrayOfSaveStates).then(() => {
  console.log('WasmBoy loaded the state!');
  // Call .play() here to continue playing the ROM.
}).catch(() => {
  console.error('WasmBoy had an error loading the state...');
});
```

And that's it! You now have a fully functional implementation of WasmBoy! Pat yourself on the back, and have a nice day! I suggest reading through the complete API, especially the options section, detailing the callbacks, as they allow experimenting with the emulator itself, and creating new experiences!

# Complete API

This documents the complete lib API. This is useful for direct reference, and what responses to expect from the lib.

## Functions

**NOTE:** Almost all functions return a Promise for API consistency.

### config

`.config(WasmBoyOptions, canvasElement)`

Parameters: JS Object (WasmBoyOptions Schema), [Canvas Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas)

Returns: Promise

This function configures WasmBoy to the passed WasmBoyOptions, and sets WasmBoy's Graphical output target to the passed Canvas element. If WasmBoy is currently running, this will pause WasmBoy, which would then require you to call `.play()` in the corresponding `.then()` block of the promise.

### loadROM

`.loadROM(myROM)`

Parameters: One of the following object types:

1. URL that we can use [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to download the file.

2. A [file](https://developer.mozilla.org/en-US/docs/Web/API/File) object from something like an [input of type="file"](https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications).

3. A [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) of the bytes that make up the ROM.

Returns: Promise

This function loads a ROM into WasmBoy. Which can then be executed by `.play()`

### play

`.play()`

Parameters: None

Returns: Promise

This starts, or resumes, execution of a loaded ROM in WasmBoy.

### pause

`.pause()`

Parameters: None

Returns: Promise

This pauses execution of a loaded ROM in WasmBoy.

### saveState

`.saveState()`

Parameters: None

Returns: Promise

This saves the current state of the executing ROM in WasmBoy. Save states are saved to [indexedDb to allow for offline browser storage](https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa). **Note:** this will also call `.pause()`, therefore to continue execution, `.play()` must be called in the resulting `.then()` block.

### getSaveStates

`.getSaveStates()`

Parameters: None

Returns: Promise

This returns an array of all of the save states for the loaded ROM, in the `.then()` block handler function of `.getSaveStates()`. This is useful for allowing a user to choose a save state to be loaded.

### loadState

`.loadState(saveState)`

Parameters: JS Object (SaveState Schema)

Returns: Promise

This loads the passed save state into WasmBoy. **Note:** this will also call `.pause()`, therefore to continue execution, `.play()` must be called in the resulting `.then()` block.

### enableDefaultJoypad

`.enableDefaultJoypad()`

Parameters: None

Returns: Promise

This will enable the default [responsive-gamepad](https://www.npmjs.com/package/responsive-gamepad) that WasmBoy uses for Joypad Input.

### disableDefaultJoypad

`.disableDefaultJoypad()`

Parameters: None

Returns: Promise

This will disable the default [responsive-gamepad](https://www.npmjs.com/package/responsive-gamepad) that WasmBoy uses for Joypad Input.

### setJoypadState

`.setJoypadState(joyPadState)`

Parameters: Joypad State Object

Returns: None

This instantly sets the Joypad State for WasmBoy. **NOTE:** This should only be called after disabling the default joypad with `.disableDefaultJoypad()`. See the JoyPad State Object in Object Schemas for the expected object.

### addTouchInput

`.addTouchInput(svgElement)`

Parameters: [SVG Element](https://developer.mozilla.org/en-US/docs/Web/API/SVGElement)

Returns: Promise

This simply calls the equivalent function in [responsive-gamepad](https://www.npmjs.com/package/responsive-gamepad). Please see the documentation there, or the usage in the debugger / demo.

## Object Schema

### WasmBoyOptions

```javascript
const WasmBoyOptionsSchema = {
  headless: false,
  useGbcWhenOptional: true,
	isAudioEnabled: true,
	frameSkip: 1,
	audioBatchProcessing: true,
	timersBatchProcessing: false,
	audioAccumulateSamples: true,
	graphicsBatchProcessing: false,
	graphicsDisableScanlineRendering: false,
	tileRendering: true,
	tileCaching: true,
	gameboyFPSCap: 60,
  updateGraphicsCallback: false,
  updateAudioCallback: false,
  saveStateCallback: false
}
```

* `headless` <boolean> - This will run the emulator headless. This is useful for TAS implementations, or for testing. If headless is set to `true`, then the canvas element passed in `.config`, may be undefined. Headless mode will not output any graphics or audio, though you may still use the callbacks to obtain access to their respective buffers.

* `useGbcWhenOptional` <boolean> - Some ROMs allow for both Gameboy, and Gameboy Color playback. This sets whether these types of ROMs will choose Gameboy or Gameboy Color ROMs to execute.

* `isAudioEnabled` <boolean> - This enables/disables audio

* `frameSkip` <integer> - This sets the number of frames that will be skipped rendering on the canvas elements.

* `audioBatchProcessing` <boolean> - [TODO: See the Performance Options Section]()

* `timersBatchProcessing` <boolean> - [TODO: See the Performance Options Section]()

* `audioAccumulateSamples` <boolean> - [TODO: See the Performance Options Section]()

* `graphicsBatchProcessing` <boolean> - [TODO: See the Performance Options Section]()

* `graphicsDisableScanlineRendering` <boolean> - [TODO: See the Performance Options Section]()

* `tileRendering` <boolean> - [TODO: See the Performance Options Section]()

* `tileCaching` <boolean> - [TODO: See the Performance Options Section]()

* `FPSCap` <integer> - The maximum number of frames per second that the core will run. This does **NOT** affect how many frames are outputted, but more of the speed at which the emulator runs. For instance, if the `FPSCap` is set to 120, the emulator will run twice as fast.

* `updateGraphicsCallback` <function> - A function called right before passing the canvas element. If this is set, you are responsible for returning the resulting [ImageData Array](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas). The function passed into this option, takes in an ImageData Array, and should return an Image Data Array. For instance, if we wanted to invert colors in the resulting frame:

```javascript
const updateGraphicsCallback = (imageDataArray) => {
  // Logic from: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
  for (var i = 0; i < imageDataArray.length; i += 4) {
    imageDataArray[i]     = 255 - imageDataArray[i];     // red
    imageDataArray[i + 1] = 255 - imageDataArray[i + 1]; // green
    imageDataArray[i + 2] = 255 - imageDataArray[i + 2]; // blue
  }

  return imageDataArray;
}
```

* `updateAudioCallback` <function> - A function called right before connecting our [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) to the [AudioContext Destination](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/destination). If this is set, you are responsible for returning an [AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode) to be connected to the AudioContext Destination. For some examples of this process, please see this [Web Audio guide on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API). The function passed into this option, takes in an [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) and a AudioBufferSourceNode, and should return an AudioNode. For instance, if we just wanted to return the exact same AudioBufferSourceNode we were passed in, it would be:

```javascript
const updateAudioCallback = (audioContext, audioBufferSourceNode) => {
  return audioBufferSourceNode;
}
```

Or if we wanted to add a simple bass boost:

```javascript

// Logic from: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API

// Only need to make the filter once, since the WasmBoy is a singleton, and only has a single Audio Context.
let bassBoost = undefined;

const updateAudioCallback = (audioContext, audioBufferSourceNode) => {
  if(!bassBoost) {
    bassBoost = audioContext.createBiquadFilter();
    bassBoost.type = "lowshelf";
    bassBoost.frequency.value = 1000;
    bassBoost.gain.value = 25;
  }

  audioBufferSourceNode.connect(bassBoost);
  return bassBoost;
}
```

* `saveStateCallback` <function> - A function called right before saving the Save State Object to the indexedDb. If this is set, you are responsible for returning a Save State object to be saved to indexedDb. Any modifications made to the returned Save State object will be saved to the indexedDb. The function passed into this option, takes in a Save State object, and must return a Save State Object. For example, if you wanted to add screenshots from the canvas element to every Save State object. you could do the following:

```javascript
const canvasElement = document.querySelector('canvas');

const saveStateCallback = (saveStateObject) => {
	saveStateObject.screenshotCanvasDataURL = canvasElement.toDataURL();
	return saveStateObject;
}
```

### Save State

```javascript
const WasmBoySaveStateSchema = {
  wasmBoyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  isAuto: undefined
}
```

* `wasmBoyMemory` - The individual bytes used for the save state, this should **NOT** be modified

* `date` - The current system time the save state was made.

* `isAuto` - Represents if the save state was automatically made by the browser being closed.

### Joypad State

```javascript
const WasmBoyJoypadState = {
  up: false,
  right: false,
  down: false,
  left: false,
  a: false,
  b: false,
  select: false,
  start: false
}
```

This names are pretty self-explanatory, and represents the buttons on the Gameboy. However, it should be known that `false` is means the button is released, `true` means the button is pressed.
