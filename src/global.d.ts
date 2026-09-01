import type { Application, Profile, ResumeRecord } from './model';

type LocalData = { applications?:Application[]; profile?:Profile; resume?:ResumeRecord|null };

declare global {
  interface Window {
    campus?: {
      loadData(): Promise<LocalData | null>;
      recoverData(): Promise<LocalData | null>;
      saveData(patch: LocalData): Promise<void>;
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
