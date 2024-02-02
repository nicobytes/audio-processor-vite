class RecordingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.sampleRate = 0;
    this.maxRecordingFrames = 0;
    this.numberOfChannels = 0;

    if (options && options.processorOptions) {
      const { numberOfChannels, sampleRate, maxFrameCount } =
        options.processorOptions;

      this.sampleRate = sampleRate;
      this.maxRecordingFrames = maxFrameCount;
      this.numberOfChannels = numberOfChannels;

      this._recordingBuffer = new Array(this.numberOfChannels).fill(
        new Float32Array(this.maxRecordingFrames)
      );

      this.recordedFrames = 0;
      this.isRecording = false;

      this.framesSinceLastPublish = 0;
      this.publishInterval = this.sampleRate / 60;

      // We will keep a live sum for rendering the visualizer.
      this.sampleSum = 0;

      this.port.onmessage = (event) => {
        console.log("event", event.data);
        const { message, newRecoringState } = event.data;
        if (message === "UPDATE_RECORDING_STATE") {
          this.updateRecordingState(newRecoringState);
        }
      };

      console.log(this.recordedFrames);
      console.log(this.maxRecordingFrames);
    }
  }

  process(inputs, outputs, params) {
    for (let input = 0; input < 1; input++) {
      for (let channel = 0; channel < this.numberOfChannels; channel++) {
        for (let sample = 0; sample < inputs[input][channel].length; sample++) {
          const currentSample = inputs[input][channel][sample];

          // Copy data to recording buffer.
          if (this.isRecording) {
            this._recordingBuffer[channel][sample + this.recordedFrames] =
              currentSample;
          }

          // Sum values for visualizer
          this.sampleSum += currentSample;
        }
      }
    }

    if (this.isRecording) {
      this.recordedFrames += 128;
    }
    return true;
  }

  updateRecordingState(newRecoringState) {
    this.isRecording = newRecoringState;

    if (this.isRecording === false) {
      this.port.postMessage({
        message: "SHARE_RECORDING_BUFFER",
        buffer: this._recordingBuffer,
        recordedFrames: this.recordedFrames,
      });
    }
  }
}

registerProcessor("recording-processor", RecordingProcessor);
