import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';

export default function Toast() {
  const { toast, dismissToast } = useShop();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 2800);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.key}>
          <Check size={16} aria-hidden="true" /> <span>{toast.message}</span>
          {/added to your bag/.test(toast.message) && <Link to="/bag" onClick={dismissToast}>View bag</Link>}
        </div>
      )}
    </div>
  );
}
