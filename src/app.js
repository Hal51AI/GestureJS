import * as css from "./style.css";
import screenfull from "screenfull";
import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// Create task for image file processing:
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
    delegate: "GPU",
  },
  numHands: 2,
  runningMode: "VIDEO",
});

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const webcamButton = document.getElementById("webcamButton");
const fullscreenButton = document.getElementById("fullscreen-button");

let lastVideoTime = -1;
let results = undefined;

let screenOpacity = 0.9;
let touchX = 0;
let dragging = false;

const drawingUtils = new DrawingUtils(canvasCtx);

function updateOpacity(currentX) {
  const distance = (currentX - touchX) / window.innerWidth;
  touchX = currentX;

  screenOpacity = Math.max(0, Math.min(1, distance + screenOpacity));
}

function getScreenSizeConstraints() {
  const isLandscape = /landscape/.test(screen.orientation.type);

  const sizes = {
    landscape: {
      width: { min: 640, ideal: Math.min(screen.width, 1280) },
      height: { min: 360, ideal: Math.min(screen.height, 720) },
    },
    portrait: {
      width: { min: 360 },
      height: { min: 640 },
    },
  };

  return isLandscape ? sizes.landscape : sizes.portrait;
}

function startWebcam() {
  if (!gestureRecognizer) {
    alert("Please wait for gestureRecognizer to load");
    return;
  }

  // setup front/back camera
  const selectedCamera = document.querySelector(
    'input[name="radio"]:checked'
  ).value;

  const constraints = {
    video: {
      ...getScreenSizeConstraints(),
      facingMode: selectedCamera,
    },
  };

  // activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    let settings = stream.getVideoTracks()[0].getSettings();
    let inputs = document.querySelector(".inputs");

    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);

    canvasElement.width = settings.width;
    canvasElement.height = settings.height;

    video.play();

    canvasElement.style.display = "block";
    inputs.style.display = "none";
  });
}

async function predictWebcam() {
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    results = gestureRecognizer.recognizeForVideo(video, Date.now());
  }

  // draw image on canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  // overlay black foreground with some opacity
  canvasCtx.globalAlpha = screenOpacity;
  canvasCtx.fillStyle = "black";
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  // draw hand landmarks
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: "#00FF00",
          lineWidth: 5,
        }
      );
      drawingUtils.drawLandmarks(landmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    }
  }

  canvasCtx.restore();
  // display gesture recognition results
  if (results.gestures.length > 0) {
    const categoryName = results.gestures[0][0].categoryName;
    const categoryScore = parseFloat(
      results.gestures[0][0].score * 100
    ).toFixed(2);
    const handedness = results.handednesses[0][0].displayName;
    const text = `GestureRecognizer: ${categoryName}, Confidence: ${categoryScore} %, Handedness: ${handedness}`;

    canvasCtx.font = "16px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.fillStyle = "white";
    canvasCtx.fillText(text, canvasElement.width / 2, 20);
  }

  // draw opacity control text
  if (dragging) {
    canvasCtx.font = "Bold 24px Helvetica";
    canvasCtx.textAlign = "center";
    canvasCtx.fillStyle = "white";
    canvasCtx.fillText(
      `Opacity: ${(screenOpacity * 100).toFixed(0)}%`,
      canvasElement.width / 2,
      canvasElement.height / 2
    );
  }

  window.requestAnimationFrame(predictWebcam);
}

// start webcam
webcamButton.addEventListener("click", startWebcam);

// full screen toggle
fullscreenButton.addEventListener("click", () => {
  if (screenfull.isEnabled) {
    screenfull.toggle(canvasElement, { navigationUI: "hide" });
  }
});

// exit full screen by clicking mouse
document.addEventListener("click", () => {
  if (screenfull.isEnabled && screenfull.isFullscreen) {
    screenfull.exit();
  }
});

// touch events for opacity control
canvasElement.addEventListener(
  "touchstart",
  (event) => {
    touchX = event.touches[0].clientX;
    dragging = true;
  },
  { passive: true }
);
canvasElement.addEventListener(
  "touchmove",
  (event) => {
    if (dragging) {
      updateOpacity(event.touches[0].clientX);
    }
  },
  { passive: true }
);
canvasElement.addEventListener("touchend", () => {
  if (dragging) {
    dragging = false;
  }
});

// mouse events for opacity control
canvasElement.addEventListener(
  "mousedown",
  (event) => {
    touchX = event.clientX;
    dragging = true;
  },
  { passive: true }
);
canvasElement.addEventListener(
  "mousemove",
  (event) => {
    if (dragging) {
      updateOpacity(event.clientX);
    }
  },
  { passive: true }
);
canvasElement.addEventListener("mouseup", () => {
  if (dragging) {
    dragging = false;
  }
});
