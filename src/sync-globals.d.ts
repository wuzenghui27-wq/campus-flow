import type {SyncState} from './sync-core';
type LocalReply<T> = {ok:true;data:T}|{ok:false;error:string};
export type LegacySummary = {available:boolean;count:number;hasProfile:boolean};
declare global {
  interface Window {
    campusSync?: {
      open(uid:string|null):LocalReply<{token:string;data:SyncState|null;warning:string}>;
      save(token:string,data:SyncState):LocalReply<boolean>;
      legacySummary(token:string):LocalReply<LegacySummary>;
      claimLegacy(token:string):LocalReply<unknown>;
    };
  }
}
