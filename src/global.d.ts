import type { LoadState, LocalData, ResumeRecord } from './model';

declare global {
  interface Window {
    campus?: {
      initialData: LoadState;
      retryLoadData(): Promise<LoadState>;
      recoverData(): Promise<LoadState>;
      saveData(patch: LocalData): Promise<LocalData>;
      openDataDirectory(): Promise<boolean>;
      checkUpdate(): Promise<{ available:boolean; version:string }>;
      installUpdate(): Promise<boolean>;
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
