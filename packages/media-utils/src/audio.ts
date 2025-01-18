import { ChildProcess, spawn } from "child_process";

export class AudioPlayer {
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

export class AudioRecorder {
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