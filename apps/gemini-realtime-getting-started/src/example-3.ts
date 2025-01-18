import WebSocket from "ws";
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

// Create WebSocket connection and audio player
const ws = new WebSocket(websocketUrl({ apiKey }));
const audioPlayer = new AudioPlayer();

// Initial configuration for Gemini
const config = {
  model: MODEL,
  generation_config: {
    temperature: 0.9,
    candidate_count: 1,
  }
};

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
    console.log("Setup complete, sending message...");
    
    // Send a message with system instruction and user content
    ws.send(JSON.stringify({
      clientContent: {
        turns: [
          {
            role: "system",
            parts: [{ text: "You are a helpful assistant" }]
          },
          {
            role: "user",
            parts: [{ text: "Hello" }]
          }
        ],
        turnComplete: true
      }
    }));
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
  audioPlayer.stop();
  ws.close();
  process.exit(0);
});