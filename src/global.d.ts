import type { ResumeRecord, ResumeExtraction } from './model';

declare global {
  interface Window {
    campus?: {
      openDataDirectory(): Promise<boolean>;
      checkUpdate(): Promise<{ available:boolean; version:string }>;
      installUpdate(): Promise<boolean>;
      pickResume(): Promise<ResumeRecord | null>;
      openResume(path: string): Promise<boolean>;
      extractResume(path: string): Promise<ResumeExtraction | null>;
      minimizeWindow(): void;
      toggleMaximizeWindow(): void;
      closeWindow(): void;
    };
  }
}

export {};
