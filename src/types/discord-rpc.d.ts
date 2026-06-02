declare module "discord-rpc" {
  export type RichPresence = {
    details?: string;
    state?: string;
    startTimestamp?: number;
    endTimestamp?: number;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    instance?: boolean;
  };

  export class Client {
    constructor(options: { transport: "ipc" | "websocket" });
    login(options: { clientId: string }): Promise<void>;
    setActivity(activity: RichPresence): Promise<void>;
    clearActivity(): Promise<void>;
    destroy(): Promise<void>;
    once(event: "ready", listener: () => void): this;
  }

  const RPC: {
    Client: typeof Client;
    register(clientId: string): boolean;
  };

  export default RPC;
}
