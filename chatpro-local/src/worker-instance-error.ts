/** Raised when another live process already owns the local worker queue. */
export class WorkerAlreadyRunningError extends Error {
  readonly existingPid: number;
  readonly existingStartedAt: string;

  constructor(existingPid: number, existingStartedAt: string) {
    super('worker_already_running');
    this.name = 'WorkerAlreadyRunningError';
    this.existingPid = existingPid;
    this.existingStartedAt = existingStartedAt;
  }
}
