import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import type { DownloadTask } from "../../../shared/types";

type DownloadRequest = {
  label: string;
  source: string;
  destination: string;
  sha1?: string;
  sha512?: string;
};

type PendingTask = {
  attempt: number;
  request: DownloadRequest;
  task: DownloadTask;
  resolve: (task: DownloadTask) => void;
  reject: (error: Error) => void;
};

type DownloadListener = (tasks: DownloadTask[]) => void;

export class DownloadManager {
  private readonly listeners = new Set<DownloadListener>();
  private readonly queue: PendingTask[] = [];
  private readonly tasks = new Map<string, DownloadTask>();
  private runningCount = 0;
  private notifyTimer?: NodeJS.Timeout;

  constructor(
    private maxParallel: number,
    private retryFailed = true
  ) {}

  setMaxParallel(limit: number): void {
    this.maxParallel = Math.max(limit, 1);
    this.pump();
  }

  setRetryFailed(enabled: boolean): void {
    this.retryFailed = enabled;
  }

  snapshot(): DownloadTask[] {
    return [...this.tasks.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async enqueue(request: DownloadRequest): Promise<DownloadTask> {
    const task: DownloadTask = {
      id: crypto.randomUUID(),
      label: request.label,
      source: request.source,
      destination: request.destination,
      bytesTransferred: 0,
      status: "queued",
      startedAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    this.notify(true);

    return new Promise<DownloadTask>((resolve, reject) => {
      this.queue.push({ attempt: 0, request, task, resolve, reject });
      this.pump();
    });
  }

  cancel(taskId: string): void {
    const index = this.queue.findIndex((entry) => entry.task.id === taskId);

    if (index === -1) {
      return;
    }

    const [entry] = this.queue.splice(index, 1);
    entry.task.status = "canceled";
    entry.task.finishedAt = new Date().toISOString();
    entry.resolve(structuredClone(entry.task));
    this.notify(true);
  }

  private flushNotify(): void {
    this.notifyTimer = undefined;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private notify(immediate = false): void {
    if (immediate) {
      if (this.notifyTimer) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = undefined;
      }
      this.flushNotify();
      return;
    }

    if (this.notifyTimer) {
      return;
    }

    this.notifyTimer = setTimeout(() => this.flushNotify(), 100);
  }

  private pump(): void {
    while (this.runningCount < Math.max(this.maxParallel, 1) && this.queue.length > 0) {
      const entry = this.queue.shift();

      if (!entry) {
        return;
      }

      void this.run(entry);
    }
  }

  private async run(entry: PendingTask): Promise<void> {
    this.runningCount += 1;
    entry.task.status = "running";
    this.notify(true);

    try {
      const completed = await this.download(entry.request, entry.task);
      entry.resolve(completed);
    } catch (error) {
      if (this.retryFailed && entry.attempt === 0) {
        entry.task.status = "queued";
        entry.task.error = undefined;
        entry.task.bytesTransferred = 0;
        this.queue.unshift({ ...entry, attempt: entry.attempt + 1 });
        this.notify(true);
        return;
      }

      entry.task.status = "failed";
      entry.task.error = error instanceof Error ? error.message : "Download failed.";
      entry.task.finishedAt = new Date().toISOString();
      this.notify(true);
      entry.reject(error as Error);
    } finally {
      this.runningCount -= 1;
      this.pump();
    }
  }

  private async download(request: DownloadRequest, task: DownloadTask): Promise<DownloadTask> {
    await mkdir(dirname(request.destination), { recursive: true });

    const response = await fetch(request.source);

    if (!response.ok || !response.body) {
      throw new Error(`Download failed with status ${response.status}.`);
    }

    const total = Number(response.headers.get("content-length") ?? "0");
    task.bytesTotal = total || undefined;
    this.notify(true);

    const nodeStream = Readable.fromWeb(response.body as never);
    const fileStream = createWriteStream(request.destination);
    const hashAlgorithm = request.sha512 ? "sha512" : request.sha1 ? "sha1" : undefined;
    const expectedHash = request.sha512 ?? request.sha1;
    const hash = hashAlgorithm ? createHash(hashAlgorithm) : undefined;

    await new Promise<void>((resolve, reject) => {
      nodeStream.on("data", (chunk: Buffer) => {
        task.bytesTransferred += chunk.length;
        if (hash) {
          hash.update(chunk);
        }
        this.notify();
      });

      nodeStream.on("error", reject);
      fileStream.on("error", reject);
      fileStream.on("close", resolve);

      nodeStream.pipe(fileStream);
    });

    if (expectedHash && hash && hash.digest("hex") !== expectedHash) {
      await unlink(request.destination).catch(() => undefined);
      throw new Error("Downloaded file did not match the expected hash.");
    }

    task.status = "completed";
    task.finishedAt = new Date().toISOString();
    this.notify(true);
    return structuredClone(task);
  }
}
