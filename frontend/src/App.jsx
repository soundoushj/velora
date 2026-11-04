import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast from './components/Toast';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Collection from './pages/Collection';
import OurStory from './pages/OurStory';
import Favorites from './pages/Favorites';
import ShoppingBag from './pages/ShoppingBag';
import Search from './pages/Search';
import ProductDetails from './pages/ProductDetails';
import CheckoutDemo from './pages/CheckoutDemo';
import Info from './pages/Info';
import NotFound from './pages/NotFound';
import Account from './pages/Account';
import AuthCallback from './pages/AuthCallback';

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="skip">Skip to content</a>
      <Navbar />
      <main id="main" key={pathname} className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/our-story" element={<OurStory />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/bag" element={<ShoppingBag />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/checkout" element={<CheckoutDemo />} />
          <Route path="/account" element={<Account />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/info/:slug" element={<Info />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <Toast />
    </>
  );
}
