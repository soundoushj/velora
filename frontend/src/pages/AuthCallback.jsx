import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Google -> backend -> here, with a one-time code in the URL. We swap it for a JWT.
// A module-level cache makes sure React StrictMode (which runs effects twice in development)
// cannot spend the single-use code twice.
const inflight = new Map();

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { exchangeCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code');
    if (!code) { navigate('/account', { replace: true }); return; }
    if (!inflight.has(code)) inflight.set(code, exchangeCode(code));
    inflight.get(code)
      .then(() => navigate('/account', { replace: true }))
      .catch((err) => setError(err.message));
  }, [params, exchangeCode, navigate]);

  return (
    <div className="container narrow page-pad center">
      {error ? <><h1>Sign-in failed</h1><p className="lead">{error}</p><a className="btn" href="/account">Back to sign in</a></> : <p className="lead" role="status">Signing you in…</p>}
    </div>
  );
}
