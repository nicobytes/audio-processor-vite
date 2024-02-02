// processor.js
// This file is evaluated in the audio rendering thread
// upon context.audioWorklet.addModule() call.

class Processor extends AudioWorkletProcessor {
  process([input], [output]) {
    console.log("input", input);
    console.log("output", output);
    // Copy inputs to outputs.
    if (output.length >= 1 && input.length >= 1) {
        output[0].set(input[0]);
    }
    
    return true;
  }
}

registerProcessor("processor", Processor);
