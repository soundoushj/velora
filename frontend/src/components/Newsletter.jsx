import { useState } from 'react';
export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address.'); setDone(false); return;
    }
    setError(''); setDone(true); setEmail('');
  };
  return (
    <section className="newsletter" id="newsletter" aria-labelledby="nl-title">
      <div className="container narrow center">
        <p className="label light">The Letter</p>
        <h2 id="nl-title">A little luxury <em>in your inbox</em></h2>
        <p className="lead">Be the first to hear about new fragrances, private releases and the stories behind each scent.</p>
        <form className="nl-form" onSubmit={submit} noValidate>
          <label htmlFor="nl-email" className="sr">Email address</label>
          <input id="nl-email" type="email" placeholder="Your email address" value={email}
            onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby="nl-msg" autoComplete="email" />
          <button type="submit" className="btn btn-light">Subscribe</button>
        </form>
        <p id="nl-msg" className={`nl-msg ${error ? 'err' : ''}`} role={error ? 'alert' : 'status'}>
          {error || (done ? 'Thank you. You are on the list. (Demo only: no email was sent or stored.)' : '')}
        </p>
        <p className="small">Only beautiful things. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
