import EmptyState from '../components/EmptyState';
export default function NotFound() {
  return <div className="container page-pad"><EmptyState title="This page has drifted away." text="The page you are looking for does not exist. Let us take you somewhere beautiful." cta="Return Home" to="/" /></div>;
}
