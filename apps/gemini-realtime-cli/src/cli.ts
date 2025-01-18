import WebSocket from "ws";
import {
  AudioPlayer,
  AudioRecorder,
  Screenshotter,
} from "@autocode2/media-utils";
import { GeminiRealtime, websocketUrl } from "@autocode2/gemini-realtime";

const MODEL = "models/gemini-2.0-flash-exp";
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("Please set GOOGLE_API_KEY environment variable");
  process.exit(1);
}

class CLI {
  private audioPlayer = new AudioPlayer();
  private audioRecorder = new AudioRecorder();
  private screenshotter = new Screenshotter();
  private gemini: GeminiRealtime;

  constructor({ apiKey }: { apiKey: string }) {
    const ws = new WebSocket(websocketUrl({ apiKey }));
    this.gemini = new GeminiRealtime(ws, {
      model: MODEL,
      generationConfig: {
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            },
          },
        },
      },
    });
    this.gemini.on("setupComplete", () => this.onSetupComplete());
    this.gemini.on("audioPart", (data) => this.onAudioMessage(data));
    this.gemini.on("textPart", (text) => process.stdout.write(text));
    this.gemini.on("close", () => {
      console.log("Disconnected");
      process.exit(0);
    });
  }

  onSetupComplete() {
    console.log("Setup complete");
    this.gemini.sendMessages({
      messages: [
        {
          role: "user",
          parts: [
            {
              text: "Hello",
            },
          ],
        },
      ],
      turnComplete: true,
    });
    this.audioRecorder.stdout?.on("data", (data) =>
      this.gemini.streamAudio(data),
    );
    this.screenshotter.screenshotInterval(1000, async (image) => {
      this.gemini.streamChunk("image/jpeg", image.toJpegSync());
    });
  }

  onAudioMessage(data: Buffer) {
    this.audioPlayer.play(data);
  }
}

new CLI({ apiKey });
