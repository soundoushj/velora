import { Link } from 'react-router-dom';
export default function EmptyState({ title, text, cta, to = '/collection', children }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {cta && <Link to={to} className="btn">{cta}</Link>}
      {children}
    </div>
  );
}
