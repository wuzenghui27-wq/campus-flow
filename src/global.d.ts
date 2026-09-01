import type { Application, Profile, ResumeRecord } from './model';

type LocalData = { applications?:Application[]; profile?:Profile; resume?:ResumeRecord|null };
type LoadState = { status:'loaded'|'empty'|'error'; source:'main'|'backup'|'legacy'|'recovery'|'none'; data:LocalData|null };

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
