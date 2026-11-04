import { Link, useParams } from 'react-router-dom';
import NotFound from './NotFound';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '../context/ShopContext';
import { formatPrice } from '../data/products';

const PAGES = {
  delivery: { title: 'Delivery', intro: 'Sample delivery policy for this concept project.', body: [
    `Orders of ${formatPrice(FREE_DELIVERY_THRESHOLD)} or more are delivered free of charge.`,
    `Orders below ${formatPrice(FREE_DELIVERY_THRESHOLD)} are charged a flat ${formatPrice(DELIVERY_FEE)} delivery fee.`,
    'Estimated delivery time: 2 to 5 working days. This is demo content: no real orders are fulfilled.'] },
  returns: { title: 'Returns', intro: 'A gentle, simple returns policy (demo content).', body: [
    'Unopened fragrances may be returned within 14 days of delivery.',
    'Opened or used fragrances cannot be returned for hygiene reasons.',
    'VELORA is a fictional concept brand, so no real returns are processed.'] },
  contact: { title: 'Contact', intro: 'We would love to hear from you (demo content).', body: [
    'Email: hello@velora.example',
    'Hours: Sunday to Thursday, 9:00 to 17:00.',
    'This is a fictional brand created for a university project; these details are placeholders and no messages are received.'] },
  faq: { title: 'Frequently Asked Questions', intro: 'A few quick answers.', body: [
    'Is this a real shop? No. VELORA is a fictional concept brand created for a university project. Product listings, prices and availability are sample content, and no orders are fulfilled.',
    'Can I pay online? No. The checkout is a demonstration and never collects payment details.',
    'How is delivery priced? Free over 20,000 DZD, otherwise a flat 600 DZD.'] },
};

export default function Info() {
  const { slug } = useParams();
  const page = PAGES[slug];
  if (!page) return <NotFound />;
  return (
    <div className="container narrow page-pad info">
      <p className="label">Customer Service</p>
      <h1>{page.title}</h1>
      <p className="lead">{page.intro}</p>
      {page.body.map((t) => <p key={t}>{t}</p>)}
      <Link to="/collection" className="btn mt">Explore the Collection</Link>
    </div>
  );
}
