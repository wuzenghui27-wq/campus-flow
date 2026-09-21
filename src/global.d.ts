/// <reference types="vite/client" />
import type { ResumeRecord, ResumeExtraction } from './model';

declare global {
  interface Window {
    campus?: {
      openDataDirectory(): Promise<boolean>;
      checkUpdate(): Promise<{ available:boolean; version:string }>;
      installUpdate(): Promise<boolean>;
      pickResume(): Promise<ResumeRecord | null>;
      extractResume(path: string): Promise<{ok:true;data:ResumeExtraction}|{ok:false;error:string}>;
      readResume(path: string): Promise<{ok:true;data:Uint8Array}|{ok:false;error:string}>;
      minimizeWindow(): void;
      toggleMaximizeWindow(): void;
      closeWindow(): void;
    };
  }
}

export {};
