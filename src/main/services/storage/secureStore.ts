import { safeStorage } from "electron";
import { JsonStore } from "./jsonStore";

type SecureRecord = Record<string, string>;

export class SecureStore {
  private readonly store: JsonStore<SecureRecord>;

  constructor(filePath: string) {
    this.store = new JsonStore<SecureRecord>(filePath);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const data = (await this.store.read()) ?? {};
    const encrypted = data[key];

    if (!encrypted) {
      return undefined;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(Buffer.from(encrypted, "base64").toString("utf8")) as T;
    }

    const value = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const data = (await this.store.read()) ?? {};
    const serialized = JSON.stringify(value);
    const encoded = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(serialized).toString("base64")
      : Buffer.from(serialized, "utf8").toString("base64");

    data[key] = encoded;
    await this.store.write(data);
  }

  async delete(key: string): Promise<void> {
    const data = (await this.store.read()) ?? {};
    delete data[key];
    await this.store.write(data);
  }
}
