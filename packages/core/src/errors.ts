export class CounterexampleStudioUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CounterexampleStudioUsageError";
  }
}
