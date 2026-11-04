import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { API_URL } from '../services/api';

const OAUTH_ERRORS = {
  oauth_denied: 'Google sign-in was cancelled.',
  oauth_session_expired: 'The Google sign-in took too long. Please try again.',
  oauth_state_mismatch: 'We could not verify the Google sign-in request. Please try again.',
  oauth_verification_failed: 'We could not verify your Google account. Please try again.',
  account_exists_use_password: 'An account with this email already exists. Please sign in with your email and password.',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Account() {
  const { user, checking, login, register, logout } = useAuth();
  const { notify } = useShop();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(OAUTH_ERRORS[params.get('error')] || '');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (mode === 'register' && form.name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!EMAIL.test(form.email.trim())) errs.email = 'Please enter a valid email address.';
    if (mode === 'register') {
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Use at least 8 characters, with letters and numbers.';
    } else if (!form.password) errs.password = 'Please enter your password.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const u = mode === 'login'
        ? await login(form.email.trim(), form.password)
        : await register(form.name.trim(), form.email.trim(), form.password);
      notify(mode === 'login' ? `Welcome back, ${u.name.split(' ')[0]}` : 'Your account has been created');
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      const fieldErrs = {};
      (err.errors || []).forEach((x) => { fieldErrs[x.field] = x.message; });
      setErrors(fieldErrs);
      setFormError(Object.keys(fieldErrs).length ? 'Please check the highlighted fields.' : err.message);
    } finally { setBusy(false); }
  };

  if (checking) return <div className="container narrow page-pad center"><p className="lead">One moment…</p></div>;

  if (user) {
    return (
      <div className="container narrow page-pad">
        <header className="section-head center"><p className="label">My Account</p><h1>Hello, {user.name.split(' ')[0]}</h1></header>
        <div className="acc-card">
          <p><strong>{user.name}</strong></p>
          <p className="muted">{user.email}</p>
          <p className="fine">Signed in with {user.authProvider === 'google' ? 'Google' : 'email and password'}.</p>
          <button type="button" className="btn btn-outline btn-block" onClick={() => { logout(); notify('You have been signed out'); }}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container narrow page-pad">
      <header className="section-head center"><p className="label">My Account</p><h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1></header>
      <div className="acc-card">
        <div className="acc-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setErrors({}); setFormError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setErrors({}); setFormError(''); }}>Create account</button>
        </div>

        {formError && <p className="acc-error" role="alert">{formError}</p>}
        <form className="co-form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="a-name">Name</label>
              <input id="a-name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="field-err" role="alert">{errors.name}</p>}
            </div>
          )}
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="field-err" role="alert">{errors.email}</p>}
          </div>
          <div className="field">
            <label htmlFor="a-password">Password</label>
            <input id="a-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
            {errors.password && <p className="field-err" role="alert">{errors.password}</p>}
          </div>
          <button type="submit" className="btn btn-block" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>

        <p className="acc-or"><span>or</span></p>
        {/* Full-page navigation: the BACKEND starts the Google OAuth flow (the client secret never reaches the browser). */}
        <a className="btn btn-outline btn-block" href={`${API_URL}/auth/google`}>Continue with Google</a>
      </div>
    </div>
  );
}
