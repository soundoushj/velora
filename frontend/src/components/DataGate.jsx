import { useShop } from '../context/ShopContext';

// Shows a loading or error state until the catalogue has arrived from the API.
export default function DataGate({ children, compact = false }) {
  const { loading, error, reloadProducts } = useShop();
  const wrap = compact ? 'data-state' : 'container page-pad data-state';
  if (loading) {
    return (
      <div className={wrap} role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading the collection…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={wrap} role="alert">
        <h2>We couldn’t load the collection.</h2>
        <p>{error}</p>
        <button type="button" className="btn" onClick={reloadProducts}>Try again</button>
      </div>
    );
  }
  return children;
}
