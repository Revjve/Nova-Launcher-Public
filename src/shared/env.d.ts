/// <reference types="vite/client" />

import type { NovaApi } from "./types";

declare global {
  interface Navigator {
    deviceMemory?: number;
  }

  interface Window {
    nova: NovaApi;
  }
}

export {};
