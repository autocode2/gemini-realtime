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
  const path =
    "google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
  return `wss://${host}/ws/${path}?key=${apiKey}`;
}

// Create WebSocket connection and audio handlers
const ws = new WebSocket(websocketUrl({ apiKey }));
const audioPlayer = new AudioPlayer();
const audioRecorder = new AudioRecorder();

// Initial configuration for Gemini with function declarations
const config = {
  model: MODEL,
  generation_config: {
    temperature: 0.9,
    candidate_count: 1,
  },
  tools: [
    {
      functionDeclarations: [
        {
          name: "lookup_weather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The location to get weather for",
              },
            },
            required: ["location"],
          },
        },
      ],
    },
  ],
};

// Function to stream audio to Gemini
function streamAudio(data: Buffer) {
  ws.send(
    JSON.stringify({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=24000",
            data: data.toString("base64"),
          },
        ],
      },
    }),
  );
}

// Mock weather data (in a real app, this would call a weather API)
function getWeather(location: string) {
  const conditions = ["sunny", "cloudy", "rainy", "windy"];
  const temps = [18, 22, 25, 28];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const temp = temps[Math.floor(Math.random() * temps.length)];
  return {
    location,
    condition,
    temperature: temp,
    unit: "celsius",
  };
}

// Handle WebSocket events
ws.on("error", console.error);

ws.on("open", () => {
  console.log("WebSocket connection established");

  // Send setup message
  ws.send(
    JSON.stringify({
      setup: config,
    }),
  );
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());

  // Handle setup completion
  if ("setupComplete" in message) {
    console.log(
      "Setup complete - start speaking! (Ask about the weather anywhere)",
    );

    // Start audio streaming
    audioRecorder.stdout?.on("data", (data: Buffer) => {
      streamAudio(data);
    });
  }
  // Handle function calls
  else if ("toolCall" in message) {
    console.log(
      "Received function call:",
      JSON.stringify(message.toolCall, null, 2),
    );

    const functionCalls = message.toolCall.functionCalls || [];
    for (const call of functionCalls) {
      if (call.name === "lookup_weather") {
        const weather = getWeather(call.args.location);

        // Send function response
        const response = JSON.stringify({
          toolResponse: {
            functionResponses: [
              {
                id: call.id,
                name: "lookup_weather",
                response: weather,
              },
            ],
          },
        });
        ws.send(response);
      }
    }
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
      else if (
        "inlineData" in part &&
        part.inlineData.mimeType?.startsWith("audio")
      ) {
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

console.log("Starting... (Press Ctrl+C to exit)");

