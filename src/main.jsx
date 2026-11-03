import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import store from '@/store';

import 'remixicon/fonts/remixicon.css';
import 'font-logos/assets/font-logos.css';
import 'flag-icons/css/flag-icons.min.css';
import '@/assets/tailwind.css';
import '@/assets/scss/global.scss';
import '@/assets/scss/react-components.scss';

store.dispatch('initTheme');

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
