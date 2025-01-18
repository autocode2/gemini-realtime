export type Config = {
  model: string;
  systemInstruction?: { parts: Part[] };
  generationConfig?: GenerationConfig;
  tools?: Tool[];
};

export interface GenerationConfig {
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseModalities?: "text" | "audio" | "image" | string;
  speechConfig?: SpeechConfig;
}

export interface SpeechConfig {
  voiceConfig?: {
    prebuiltVoiceConfig?: {
      voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";
    };
  };
}

export type Tool = FunctionDeclaration | GoogleSearchRetrieval | CodeExecution;

export type FunctionDeclaration = {
  functionDeclarations: {
    name: string;
    description?: string;
    parameters?: object;
  }[];
};

export type GoogleSearchRetrieval = {
  googleSearchRetrieval: {
    dynamicRetrievalConfig?: {
      mode: string;
      threshold: number;
    };
  };
};

export type CodeExecution = {
  codeExecution: object;
};

export type RealtimeResponse =
  | SetupComplete
  | ServerContent
  | ToolCall
  | ToolCallCancellation;

export type SetupComplete = {
  setupComplete: object;
};

export type ServerContent = {
  serverContent: {
    modelTurn?: {
      parts: Array<TextPart | InlineDataPart>;
    };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
};

export type ToolCall = {
  toolCall: {
    functionCalls: FunctionCallPart[];
  };
};

export type ToolCallCancellation = {
  toolCallCancellation: {
    ids: string[];
  };
};

// BidiGenerateContentClientContent
export type ClientContent = {
  clientContent: {
    turns: Message[];
    turnComplete: boolean;
  };
};

export type RealtimeInput = {
  mediaChunks: {
    mimeType: string;
    data: string;
  }[];
};

export type Message = {
  role: string;
  parts: TextPart[];
};

export type Part =
  | TextPart
  | InlineDataPart
  | FunctionCallPart
  | FunctionResponsePart;

export type TextPart = {
  text: string;
};

export type InlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

export type FunctionCallPart = {
  functionCall: {
    name: string;
    args: object;
  };
};

export type FunctionResponsePart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

export function isSetupComplete(msg: RealtimeResponse): msg is SetupComplete {
  return "setupComplete" in msg;
}
export function isServerContent(msg: RealtimeResponse): msg is ServerContent {
  return "serverContent" in msg;
}
export function isToolCall(msg: RealtimeResponse): msg is ToolCall {
  return "toolCall" in msg;
}
export function isToolCallCancellation(
  msg: RealtimeResponse,
): msg is ToolCallCancellation {
  return "toolCallCancellation" in msg;
}

export function isInlineDataPart(part: Part): part is InlineDataPart {
  return "inlineData" in part;
}
export function isFunctionCallPart(part: Part): part is FunctionCallPart {
  return "functionCall" in part;
}
export function isFunctionResponsePart(
  part: Part,
): part is FunctionResponsePart {
  return "functionResponse" in part;
}
export function isTextPart(part: Part): part is TextPart {
  return "text" in part;
}
