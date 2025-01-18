# @autocode2/gemini-realtime

## Installation

Requires a `ws` compatible WebSocket implementation.

```bash
npm install @autocode2/gemini-realtime
```

## Example

```typescript
import { GeminiRealtime, websocketUrl } from "@autocode2/gemini-realtime";

const MODEL = "models/gemini-2.0-flash-exp";
const ws = new WebSocket(websocketUrl({ apiKey }));
const gemini = new GeminiRealtime(ws, {
  model: MODEL,
  generationConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Fenrir",
      },
    },
  },
});

gemini.on("setupComplete", () => {
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

    // Stream audio data to the Gemini API

    // audioRecorder.on("data", (data) =>
    //   this.gemini.streamAudio(data),
    // );
});
gemini.on("audioPart", (data) => onAudioMessage(data));
gemini.on("textPart", (text) => process.stdout.write(text));
gemini.on("close", () => {
  console.log("Disconnected");
  process.exit(0);
});

```

## Usage and API

### Setup

This library is bring your own websocket implementation. So you first need to create a websocket connection, you can use the `websocketUrl` function to get the URL to connect to.

Then you pass the model configuration and the websocket connection to the `GeminiRealtime` class.  GeminiRealtime will handle the handshake with the gemini api and emit a `setupComplete` event.  You can use this event to start sending and receiving messages.

### Sending Messages

There are two methods to send messages:
- `streamChunk(mimeType: string, buffer: Buffer | string)` which streams a chunk of multimodal data to Gemini.  If a buffer is passed it will be converted to a base64 string.  If a string is passed it is assumed to already be base64 encoded.
- ` sendMessages(args: { messages: Message[]; turnComplete: boolean; })` which sends non-streaming messages.  These are normal Gemini messages with a `role` and `parts` field. Additionally `turnComplete` signals to Gemini that its turn next in the conversation.

### Receiving Messages

Gemini-Realtime sends the following events:

- `setupComplete` when the connection is established and the handshake is complete.
- `serverContent` with response messages from Gemini.
- `toolCall` for tool calls
- `toolCallCancellation` for tool call cancellations

In addition to these events you can listen for the parts of the serverContent messages with the following events:

- `audioPart` for audio parts
- `textPart` for text parts
- `endTurn` when gemini has completed its turn
- `interrupted` when gemini has detected an interruption.  This can be used to stop the audio playback and clear the audio buffer.
