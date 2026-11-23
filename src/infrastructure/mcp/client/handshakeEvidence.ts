export class HandshakeEvidence {
  private active = true;
  private readonly started = performance.now();
  private readonly errors: Error[] = [];
  private discarded = 0;
  private spawnFailure = false;
  constructor(private readonly maximumErrors: number) {}
  isRecording() {
    return this.active;
  }
  record(error: Error) {
    if (!this.active || this.errors.includes(error)) {
      return;
    }
    const syscall: unknown = Reflect.get(error, "syscall");
    this.spawnFailure ||= typeof syscall === "string" && syscall.startsWith("spawn");
    if (this.errors.length < this.maximumErrors) {
      this.errors.push(error);
    } else {
      this.discarded += 1;
    }
  }
  stop() {
    this.active = false;
  }
  spawnFailed() {
    return this.spawnFailure;
  }
  snapshot() {
    return {
      durationMs: performance.now() - this.started,
      transportErrors: [...this.errors],
      transportErrorsDiscarded: this.discarded,
    };
  }
}
