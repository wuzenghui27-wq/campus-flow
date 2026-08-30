import type { ResumeRecord } from './model';

declare global {
  interface Window {
    campus?: {
      pickResume(): Promise<ResumeRecord | null>;
      openResume(path: string): Promise<boolean>;
      extractResume(path: string): Promise<string | null>;
      minimizeWindow(): void;
      toggleMaximizeWindow(): void;
      closeWindow(): void;
    };
  }
}

export {};
