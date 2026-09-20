import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import './AccountPanel.css';

type AccountMode = 'login' | 'register' | 'reset';

const resetNotice = '如果该邮箱已注册，会收到密码重置邮件；请同时检查垃圾邮件。';

/** Translate common authentication failures without exposing passwords.
 * 将常见认证错误转为中文，不记录或显示密码。
 */
function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return '操作失败，请稍后重试。';
  }

  const messages: Record<string, string> = {
    'auth/invalid-email': '邮箱格式不正确，请检查。',
    'auth/missing-password': '请输入密码。',
    'auth/invalid-credential': '邮箱或密码不正确。',
    'auth/invalid-login-credentials': '邮箱或密码不正确。',
    'auth/wrong-password': '邮箱或密码不正确。',
    'auth/user-not-found': '邮箱或密码不正确。',
    'auth/email-already-in-use': '无法使用此邮箱注册，请尝试登录或找回密码。',
    'auth/weak-password': '密码不符合要求，请使用更长的密码。',
    'auth/password-does-not-meet-requirements':
      '密码不符合项目设置的要求，请增加长度或调整字符组合。',
    'auth/user-disabled': '该账号已被停用，请联系应用维护者。',
    'auth/operation-not-allowed':
      '邮箱密码登录尚未启用，请检查 Firebase Authentication 的登录方式。',
    'auth/configuration-not-found':
      '认证服务尚未配置，请检查 Firebase Authentication。',
    'auth/invalid-api-key': 'Firebase API key 无效，请核对 firebase.ts。',
    'auth/network-request-failed':
      '连接失败，请检查网络、index.html 和 electron/main.cjs 的联网限制。',
    'auth/too-many-requests': '操作过于频繁，请稍后再试。',
    'auth/quota-exceeded': '服务额度暂时不足，请稍后再试。',
  };

  return messages[error.code] ?? `操作失败（${error.code}），请稍后重试。`;
}

/** Authenticate users; the workspace controller separately owns data sync.
 * 认证组件不直接读写投递资料，同步由独立工作区负责。
 */
export default function AccountPanel({pendingCount = 0}: {pendingCount?: number}) {
  const inputId = useId();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AccountMode>('login');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const requestRunning = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (mounted.current) {
        setUser(currentUser);
        setReady(true);
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  /** Switch forms and discard any password left in the old form.
   * 切换表单，并通过 form 的 key 清除旧表单中的密码。
   */
  function changeMode(nextMode: AccountMode) {
    if (requestRunning.current) return;
    setMode(nextMode);
    setErrorMessage('');
    setNotice('');
  }

  /** Submit one account request; let the SDK own authentication state.
   * 一次只提交一个认证请求，登录状态由 SDK 的监听器更新。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || requestRunning.current) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') ?? '').trim();
    // Do not trim passwords: spaces can be intentional.
    // 不修剪密码，空格可能是密码的一部分。
    const password = String(fields.get('password') ?? '');
    const confirmation = String(fields.get('confirmation') ?? '');
    setErrorMessage('');
    setNotice('');

    if (mode === 'register' && password !== confirmation) {
      setErrorMessage('两次输入的密码不一致。');
      return;
    }

    requestRunning.current = true;
    setBusy(true);
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await sendPasswordResetEmail(auth, email);
        if (mounted.current) setNotice(resetNotice);
      }
      form.reset();
    } catch (error: unknown) {
      if (mounted.current) {
        // Keep password recovery responses neutral for unknown accounts.
        // 找回密码时不透露某个邮箱是否存在。
        if (mode === 'reset' && error instanceof FirebaseError &&
            error.code === 'auth/user-not-found') {
          setNotice(resetNotice);
        } else {
          setErrorMessage(getAuthErrorMessage(error));
        }
      }
    } finally {
      requestRunning.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  /** End this Firebase session; never clear the application's local files.
   * 退出 Firebase 登录，不清空原软件的本地文件。
   */
  async function handleSignOut() {
    if (requestRunning.current) return;
    if (pendingCount > 0 && !window.confirm(`还有 ${pendingCount} 项尚未同步。它们已存入当前账号的本地副本，下次登录该账号继续同步。现在退出？`)) return;
    requestRunning.current = true;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      await signOut(auth);
      if (mounted.current) setMode('login');
    } catch (error: unknown) {
      if (mounted.current) setErrorMessage(getAuthErrorMessage(error));
    } finally {
      requestRunning.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const buttonLabel = mode === 'register'
    ? '注册并登录'
    : mode === 'reset' ? '发送重置邮件' : '登录';

  return (
    <section className="account-panel" aria-label="账号与云同步">
      <div className="account-panel__header">
        <div className="account-panel__identity" role="status">
          <strong>账号与云同步</strong>
          <span>
            {!ready ? '正在读取登录状态…' :
              user ? `已登录：${user.email ?? '当前账号'}` : '未登录'}
          </span>
        </div>
        {ready && user && (
          <button className="pixel-button secondary" type="button"
            disabled={busy} onClick={() => void handleSignOut()}>
            {busy ? '正在退出…' : '退出登录'}
          </button>
        )}
      </div>

      <p className="account-panel__warning">
        登录后仅同步投递记录与个人资料文字。PDF 文件和本机路径不上传；同步进度以下方状态为准。
      </p>

      {ready && !user && (
        <details className="account-panel__details">
          <summary>打开登录 / 注册</summary>
          <div className="account-panel__modes" aria-label="选择账号操作">
            <button type="button" aria-pressed={mode === 'login'}
              disabled={busy} onClick={() => changeMode('login')}>登录</button>
            <button type="button" aria-pressed={mode === 'register'}
              disabled={busy} onClick={() => changeMode('register')}>注册账号</button>
            <button type="button" aria-pressed={mode === 'reset'}
              disabled={busy} onClick={() => changeMode('reset')}>忘记密码</button>
          </div>

          <form key={mode} onSubmit={(event) => void handleSubmit(event)}>
            <div className="account-panel__fields">
              <label htmlFor={`${inputId}-email`}>
                邮箱
                <input id={`${inputId}-email`} name="email" type="email"
                  autoComplete="username" autoCapitalize="none"
                  spellCheck={false} required disabled={busy}
                  placeholder="输入你的邮箱" />
              </label>
              {mode !== 'reset' && (
                <label htmlFor={`${inputId}-password`}>
                  密码
                  <input id={`${inputId}-password`} name="password"
                    type="password" required disabled={busy}
                    minLength={mode === 'register' ? 6 : undefined}
                    autoComplete={mode === 'register'
                      ? 'new-password' : 'current-password'}
                    placeholder={mode === 'register'
                      ? '至少 6 位，建议使用更长的独立密码' : '输入密码'} />
                </label>
              )}
              {mode === 'register' && (
                <label htmlFor={`${inputId}-confirmation`}>
                  确认密码
                  <input id={`${inputId}-confirmation`} name="confirmation"
                    type="password" autoComplete="new-password" required
                    disabled={busy} placeholder="再次输入密码" />
                </label>
              )}
            </div>
            <button className="pixel-button" type="submit" disabled={busy}>
              {busy ? '正在处理…' : buttonLabel}
            </button>
          </form>
        </details>
      )}
      {errorMessage && <p className="account-panel__error" role="alert">
        {errorMessage}
      </p>}
      {notice && <p className="account-panel__notice" role="status">
        {notice}
      </p>}
    </section>
  );
}
