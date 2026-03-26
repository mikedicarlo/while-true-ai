import fs from "node:fs";
import { getLogger } from "../observability/logger.js";

const log = getLogger("safety:killswitch");

export class KillSwitch {
  private triggered = false;

  constructor(private filePath: string) {}

  check(): boolean {
    if (this.triggered) return true;

    if (fs.existsSync(this.filePath)) {
      this.triggered = true;
      log.warn("Kill switch file detected, shutting down");
      return true;
    }

    return false;
  }

  trigger(): void {
    this.triggered = true;
    try {
      fs.writeFileSync(this.filePath, new Date().toISOString());
      log.info("Kill switch triggered");
    } catch (error) {
      log.error({ error }, "Failed to write kill switch file");
    }
  }

  reset(): void {
    this.triggered = false;
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch {
      // Ignore
    }
  }

  get isTriggered(): boolean {
    return this.triggered;
  }
}
