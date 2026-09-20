import type {WorkspaceController} from './useWorkspace';
import {conflictValues} from './useWorkspace';
import {dataView} from './sync-core';
import './SyncPanel.css';

export default function SyncPanel({controller}:{controller:WorkspaceController}) {
  const view=controller.snapshot();
  const {state}=view;
  const conflicts=Object.keys(state.conflicts);
  const pending=state.outbox.length;
  const label=!state.uid?'本地模式（独立工作区）':
    conflicts.length?`有 ${conflicts.length} 项冲突待确认`:
    view.error?'同步受阻，数据仍保存在本机':
    !view.connected?'正在连接／离线：本机修改会等待同步':
    pending?`待同步 ${pending} 项${view.working?'（正在发送）':''}`:'已同步';
  function attempt(fn:()=>void) {try{fn();}catch(error){alert((error as Error).message);}}
  function importOld() {
    const name=view.email||'当前账号';
    if (!confirm(`请确认旧记录属于你，并同意将投递记录和个人资料文字上传至账号 ${name}。\n\n只追加缺失的记录和资料字段，不覆盖云端现有数据。PDF 和本机路径不上传。\n\n这份旧记录将只允许此账号导入，是否继续？`)) return;
    attempt(()=>{
      const result=controller.importLegacy();
      alert(`已加入本机待同步队列：${result.imported} 条投递、${result.fields} 项资料。\n跳过 ${result.skipped} 条已有同 ID 记录（包括删除标记）。\n请等待状态变为“已同步”；原 data.json 未修改。`);
    });
  }
  function choose(key:string,choice:'local'|'cloud') {
    const text=choice==='local'?'以本机版本更新这条云端记录':'放弃这条本机修改，使用云端版本';
    if(confirm(`${text}？其他记录不受影响。确认后会先将冲突双方备份到账号副本的 conflictArchive 中。`)) {
      attempt(()=>controller.chooseConflict(key,choice));
    }
  }
  return <section className="sync-panel" aria-label="同步状态">
    <div className="sync-panel__row">
      <strong role="status">{label}</strong>
      {state.uid && <button type="button" className="pixel-button secondary"
        disabled={view.working} onClick={()=>attempt(()=>controller.retry())}>重新连接</button>}
    </div>
    {!state.uid && <p>未登录工作区不会显示任何账号的资料。旧版本记录请登录后确认导入；没有删除原文件。</p>}
    {view.warning && <p role="alert">{view.warning}</p>}
    {view.error && <p className="sync-panel__error" role="alert">{view.error}</p>}
    {view.legacy.available && !state.legacyImported && state.uid && (
      state.legacyDismissed ? <button type="button" className="pixel-button secondary"
        onClick={()=>attempt(()=>controller.showLegacy())}>重新显示旧记录导入提示</button> :
      <div className="sync-panel__migration">
        <strong>检测到旧版本本地资料：{view.legacy.count} 条投递记录</strong>
        <p>当前账号：{view.email}。导入前请核对归属；云端已有同 ID 的记录不会被覆盖。</p>
        <div className="sync-panel__row">
          <button type="button" className="pixel-button" disabled={!view.connected||view.working}
            onClick={importOld}>确认归属并导入旧记录</button>
          <button type="button" className="pixel-button secondary"
            onClick={()=>attempt(()=>controller.dismissLegacy())}>暂不导入</button>
        </div>
      </div>
    )}
    {conflicts.map(key=>{
      const pair=conflictValues(state,key);
      const title=key.startsWith('p_')?`个人资料：${key.slice(2)}`:`投递：${key.slice(2)}`;
      return <details key={key} className="sync-panel__conflict">
        <summary>{title}：两台设备修改了同一项，请选择版本</summary>
        <div className="sync-panel__compare"><div><strong>本机待保存版本</strong>
          <pre>{pair.local===null?'已删除':JSON.stringify(pair.local,null,2)}</pre></div>
          <div><strong>当前云端版本</strong><pre>{pair.cloud===null?'已删除／不存在':JSON.stringify(pair.cloud,null,2)}</pre></div></div>
        <div className="sync-panel__row"><button type="button" className="pixel-button"
          onClick={()=>choose(key,'local')}>保留本机版本</button>
          <button type="button" className="pixel-button secondary"
            onClick={()=>choose(key,'cloud')}>使用云端版本</button></div>
      </details>;
    })}
    {state.uid && <small>当前账号：{dataView(state).applications.length} 条投递。
      本地副本按 UID 分开；退出后不在界面展示该账号的数据。此机制不替代操作系统磁盘权限或磁盘加密。</small>}
  </section>;
}
