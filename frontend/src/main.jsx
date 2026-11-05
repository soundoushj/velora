import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ShopProvider } from './context/ShopContext';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/luxury.css';
import './styles/mobile.css';
import './styles/account.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopProvider><App /></ShopProvider>
    </BrowserRouter>
  </React.StrictMode>
);