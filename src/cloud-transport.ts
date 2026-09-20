import {collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {auth,db} from './firebase';
import {cleanEntry} from './sync-core';
import type {Entry,Operation} from './sync-core';
export type WriteResult={ok:true;entry:Entry}|{ok:false;remote:Entry|null};
export function createTransport(uid:string,active:()=>boolean) {
  function check() {
    if (!active() || auth.currentUser?.uid!==uid) throw new Error('账号已切换，同步已停止');
  }
  return {
    watch(onData:(data:Record<string,Entry>)=>void,onError:(error:unknown)=>void,onCache:()=>void) {
      check();
      return onSnapshot(collection(db,'users',uid,'entries'),
        {includeMetadataChanges:true},snapshot=>{
          if (!active() || auth.currentUser?.uid!==uid) return;
          // Only server-confirmed snapshots can be called “synced”.
          if (snapshot.metadata.fromCache) {onCache();return;}
          if (snapshot.metadata.hasPendingWrites) return;
          try {
            const values:Record<string,Entry>={};
            snapshot.forEach(item=>{values[item.id]=cleanEntry(item.id,item.data());});
            onData(values);
          } catch(error) {onError(error);}
        },onError);
    },
    async write(op:Operation):Promise<WriteResult> {
      check();
      const ref=doc(db,'users',uid,'entries',op.key);
      return runTransaction(db,async transaction=>{
        check();
        const snapshot=await transaction.get(ref);
        check();
        const remote=snapshot.exists()?cleanEntry(op.key,snapshot.data()):null;
        if (remote?.mutationId===op.id) return {ok:true,entry:remote} as WriteResult;
        if ((remote?.revision??0)!==op.baseRevision) {
          return {ok:false,remote} as WriteResult;
        }
        const entry:Entry={kind:op.kind,value:op.value,deleted:op.deleted,
          revision:op.baseRevision+1,mutationId:op.id};
        transaction.set(ref,{...entry,updatedAt:serverTimestamp()});
        return {ok:true,entry} as WriteResult;
      });
    },
  };
}
