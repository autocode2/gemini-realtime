import WebSocket from "ws";

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

// Create WebSocket connection
const ws = new WebSocket(websocketUrl({ apiKey }));

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
  } else {
    // Log all other messages
    console.log("Received message:", JSON.stringify(message, null, 2));
  }
});

// Handle interruption
process.on("SIGINT", () => {
  ws.close();
  process.exit(0);
});