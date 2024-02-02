import "./style.css";
import createWaveFileBlobFromAudioBuffer from "./exporter";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h2>How to process audio from the user's microphone</h2>
    <p>Size: <span id="size">0s</span></p>
    <button id="startButton">Start</button>
    <button id="stopButton" disabled>Stop</button>
    <a id="downloadLink">Download</a>
    <pre id="logs"></pre>
  </div>
`;

interface RecordingProperties {
  numberOfChannels: number;
  sampleRate: number;
  maxFrameCount: number;
}

const RecorderStates = {
  UNINITIALIZED: 0,
  RECORDING: 1,
  PAUSED: 2,
  FINISHED: 3,
};

let recordingState = RecorderStates.UNINITIALIZED;

const text = document.querySelector<HTMLElement>("#text")!;
const startButton = document.querySelector<HTMLButtonElement>("#startButton")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stopButton")!;
const downloadLink =
  document.querySelector<HTMLAnchorElement>("#downloadLink")!;

const context = new AudioContext();

startButton.addEventListener(
  "click",
  async () => {
    await initializeAudio();
    changeButtonsStatus();
  },
  { once: true }
);

stopButton.addEventListener("click", () => {});

function changeButtonsStatus() {
  const isRecording = recordingState === RecorderStates.RECORDING;
  startButton.disabled = isRecording ? true : false;
  stopButton.disabled = isRecording ? false : true;
}

async function initializeAudio() {
  if (context.state === "suspended") {
    await context.resume();
  }

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    },
    video: false,
  });

  const micSourceNode = new MediaStreamAudioSourceNode(context, {
    mediaStream,
  });

  const processorOptions = {
    numberOfChannels: micSourceNode.channelCount,
    sampleRate: context.sampleRate,
    maxFrameCount: context.sampleRate * 300,
  };

  const recordingNode = await setupRecordingWorkletNode(processorOptions);

  handleRecording(recordingNode.port, processorOptions);

  recordingNode.port.onmessage = (event) => {
    const data = event.data;
    if (data.message === "SHARE_RECORDING_BUFFER") {
      recordingState = RecorderStates.FINISHED;
      generateAudio(data.buffer, processorOptions.sampleRate, data.recordedFrames);
    }
  };

  micSourceNode.connect(recordingNode).connect(context.destination);
}

async function setupRecordingWorkletNode(
  processorOptions: RecordingProperties
) {
  await context.audioWorklet.addModule("./recording-processor.js");

  const WorkletRecordingNode = new AudioWorkletNode(
    context,
    "recording-processor",
    {
      processorOptions,
    }
  );

  return WorkletRecordingNode;
}

function handleRecording(
  processorPort: MessagePort,
  recordingProperties: RecordingProperties
) {
  let recordingLength = 0;

  if (recordingState === RecorderStates.UNINITIALIZED) {
    recordingState = RecorderStates.RECORDING;
    processorPort.postMessage({
      message: "UPDATE_RECORDING_STATE",
      newRecoringState: true,
    });
    changeButtonsStatus();
  }

  startButton.addEventListener("click", () => {
    recordingState = RecorderStates.RECORDING;
    processorPort.postMessage({
      message: "UPDATE_RECORDING_STATE",
      setRecording: true,
    });
    changeButtonsStatus();
  });

  stopButton.addEventListener("click", () => {
    recordingState = RecorderStates.PAUSED;
    processorPort.postMessage({
      message: "UPDATE_RECORDING_STATE",
      newRecoringState: false,
    });
    changeButtonsStatus();
  });
}

function generateAudio(buffer: Float32Array[], sampleRate: number, recordingLength:number) {

  console.log(buffer.length);
  console.log(sampleRate);
  console.log(recordingLength);

  const recordingBuffer = context.createBuffer(
    buffer.length,
    recordingLength,
    sampleRate
  );

  console.log(buffer)

  buffer.forEach((channelData, index) => {
    recordingBuffer.copyToChannel(channelData, index, 0);
  });

  const blob = createWaveFileBlobFromAudioBuffer(recordingBuffer, true);
  const audioFileUrl = URL.createObjectURL(blob);
  downloadLink.href = audioFileUrl;
  downloadLink.download = `recording-${new Date()
    .getMilliseconds()
    .toString()}.wav`;
}
