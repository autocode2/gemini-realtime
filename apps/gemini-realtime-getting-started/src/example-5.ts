import WebSocket from "ws";
import { Monitor, Image } from "node-screenshots";
import { ChildProcess, spawn } from "child_process";

// Audio playback class
class AudioPlayer {
  private sox: ChildProcess;

  constructor() {
    this.sox = spawn("play", [
      "-t",
      "raw",
      "-r",
      "24k",
      "-e",
      "signed-integer",
      "-b",
      "16",
      "-c",
      "1",
      "-",
    ]);
  }

  play(data: Buffer) {
    if (!this.sox?.stdin?.writable) {
      console.error("SOX stdin not ready");
      return;
    }
    this.sox.stdin.write(data);
  }

  stop() {
    this.sox.kill();
  }
}

// Audio recording class
class AudioRecorder {
  private sox: ChildProcess;

  constructor() {
    this.sox = spawn("rec", [
      "-t",
      "raw",
      "-r",
      "16k",
      "-e",
      "signed-integer",
      "-b",
      "16",
      "-c",
      "1",
      "-",
    ]);
  }

  stop() {
    this.sox.kill();
  }

  get stdout() {
    return this.sox.stdout;
  }
}

// Screenshot capture class
class Screenshotter {
  constructor() {}

  screenshot() {
    const monitor = Monitor.fromPoint(100, 100);
    if (!monitor) {
      throw new Error("No monitor found");
    }

    const image = monitor.captureImageSync();
    return image;
  }

  screenshotInterval(interval: number, callback: (image: Image) => void) {
    setInterval(() => {
      const image = this.screenshot();
      callback(image);
    }, interval);
  }
}

// Configuration
const HOST = `generativelanguage.googleapis.com`;
const MODEL = "models/gemini-2.0-flash-exp";

// Get API key from environment variable
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("Please set GOOGLE_API_KEY environment variable");
  process.exit(1);
}

// Construct the WebSocket URL
function websocketUrl({
  apiKey,
  host = HOST,
}: {
  apiKey: string;
  host?: string;
}) {
  const path = "google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
  return `wss://${host}/ws/${path}?key=${apiKey}`;
}

// Create WebSocket connection and media handlers
const ws = new WebSocket(websocketUrl({ apiKey }));
const audioPlayer = new AudioPlayer();
const audioRecorder = new AudioRecorder();
const screenshotter = new Screenshotter();

// Initial configuration for Gemini
const config = {
  model: MODEL,
  generation_config: {
    temperature: 0.9,
    candidate_count: 1,
  }
};

// Function to stream media data to Gemini
function streamMedia(mimeType: string, data: Buffer) {
  ws.send(JSON.stringify({
    realtimeInput: {
      mediaChunks: [
        {
          mimeType,
          data: data.toString("base64")
        }
      ]
    }
  }));
}

// Handle WebSocket events
ws.on("error", console.error);

ws.on("open", () => {
  console.log("WebSocket connection established");
  
  // Send setup message
  ws.send(JSON.stringify({
    setup: config
  }));
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());
  
  // Handle setup completion
  if ("setupComplete" in message) {
    console.log("Setup complete, starting screen sharing and audio...");
    
    // Send initial message
    ws.send(JSON.stringify({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: "I'm going to share my screen with you and talk. Please respond to what you see and hear." }]
          }
        ],
        turnComplete: true
      }
    }));

    // Start screen sharing
    screenshotter.screenshotInterval(1000, (image) => {
      streamMedia("image/jpeg", image.toJpegSync());
    });

    // Start audio streaming
    audioRecorder.stdout?.on("data", (data: Buffer) => {
      streamMedia("audio/pcm;rate=24000", data);
    });
  } 
  // Handle server content
  else if ("serverContent" in message) {
    const parts = message.serverContent?.modelTurn?.parts || [];
    
    for (const part of parts) {
      // Handle text parts
      if ("text" in part) {
        console.log("Gemini:", part.text);
      }
      // Handle audio parts
      else if ("inlineData" in part && part.inlineData.mimeType?.startsWith("audio")) {
        const audioData = Buffer.from(part.inlineData.data, "base64");
        audioPlayer.play(audioData);
      }
    }

    // If the turn is complete, log it
    if (message.serverContent?.turnComplete) {
      console.log("Turn complete");
    }
  }
});

// Handle interruption
process.on("SIGINT", () => {
  audioRecorder.stop();
  audioPlayer.stop();
  ws.close();
  process.exit(0);
});

console.log("Starting multimodal interaction... (Press Ctrl+C to exit)");