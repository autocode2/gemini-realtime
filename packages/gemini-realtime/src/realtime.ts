import WebSocket from "ws";
import {
  Config,
  RealtimeResponse,
  Message,
  ToolCall,
  ToolCallCancellation,
  isInlineDataPart,
  isTextPart,
  isSetupComplete,
  isServerContent,
  isToolCall,
  isToolCallCancellation,
  ServerContent,
} from "./types.js";
import EventEmitter from "events";

const HOST = `generativelanguage.googleapis.com`;
const BIDI_PATH = `google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

export function websocketUrl({
  apiKey,
  host = HOST,
  path = BIDI_PATH,
}: {
  apiKey: string;
  host?: string;
  path?: string;
}) {
  return `wss://${host}/ws/${path}?key=${apiKey}`;
}

export type Events = {
  // WebSocket events
  error: unknown;
  open: void;
  close: void;

  // Generic Response
  response: RealtimeResponse;

  // Individual Response Types
  setupComplete: void;
  serverContent: ServerContent;
  toolCall: ToolCall;
  toolCallCancellation: ToolCallCancellation;

  // Message Parts
  textPart: string;
  audioPart: Buffer;
  interrupted: void;
  turnComplete: void;
};

export class GeminiRealtime {
  private emitter = new EventEmitter();

  constructor(
    public ws: WebSocket,
    public config: Config,
  ) {
    this.initializeWebSocket();
  }

  on<TEventName extends keyof Events & string>(
    eventName: TEventName,
    handler: (eventArg: Events[TEventName]) => void,
  ) {
    this.emitter.on(eventName, handler);
  }

  off<TEventName extends keyof Events & string>(
    eventName: TEventName,
    handler: (eventArg: Events[TEventName]) => void,
  ) {
    this.emitter.off(eventName, handler);
  }

  private emit<TEventName extends keyof Events & string>(
    eventName: TEventName,
    eventArg: Events[TEventName],
  ) {
    this.emitter.emit(eventName, eventArg);
  }

  private initializeWebSocket() {
    this.ws.on("error", (err) => this.emit("error", err));

    this.ws.on("open", () => {
      this.ws.send(
        JSON.stringify({
          setup: this.config,
        }),
      );
      this.emit("open", undefined);
    });
    this.ws.on("message", (data) => {
      const msg: RealtimeResponse = JSON.parse(data.toString());
      this.handleMessage(msg);
    });
    this.ws.on("close", () => {
      this.emit("close", undefined);
    });
  }

  private handleMessage(msg: RealtimeResponse) {
    this.emit("response", msg);
    if (isSetupComplete(msg)) {
      this.emit("setupComplete", undefined);
      return;
    }
    if (isServerContent(msg)) {
      this.emit("serverContent", msg);
      const parts = msg.serverContent.modelTurn?.parts || [];
      for (const part of parts) {
        if (isInlineDataPart(part)) {
          if (part.inlineData.mimeType.startsWith("audio")) {
            const buffer = Buffer.from(part.inlineData.data, "base64");
            this.emit("audioPart", buffer);
          }
        } else if (isTextPart(part)) {
          this.emit("textPart", part.text);
        }
      }
      if (msg.serverContent.interrupted) {
        this.emit("interrupted", undefined);
      }
      if (msg.serverContent.turnComplete) {
        this.emit("turnComplete", undefined);
      }
    } else if (isToolCall(msg)) {
      this.emit("toolCall", msg);
    } else if (isToolCallCancellation(msg)) {
      this.emit("toolCallCancellation", msg);
    }
  }

  streamChunk(mimeType: string, buffer: Buffer | string) {
    const data =
      typeof buffer === "string" ? buffer : buffer.toString("base64");
    const realtimeInput = {
      mediaChunks: [
        {
          mimeType,
          data,
        },
      ],
    };
    this.ws.send(JSON.stringify({ realtimeInput }));
  }

  streamAudio(data: Buffer) {
    this.streamChunk(`audio/pcm;rate=24000`, data);
  }

  sendMessages({
    messages,
    turnComplete = true,
  }: {
    messages: Message[];
    turnComplete: boolean;
  }) {
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: messages,
          turnComplete,
        },
      }),
    );
  }
}
