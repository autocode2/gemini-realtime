import { Monitor, Image } from "node-screenshots";

export class Screenshotter {
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