import { lazy, Suspense, useEffect } from 'react';
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import store from '@/store';
import wsInit from '@/ws';

const Home = lazy(() => import('@/views/Home'));
let bootPromise;

function bootApplication() {
  if (!bootPromise) {
    bootPromise = (async () => {
      store.dispatch('watchWsMsg');
      await store.dispatch('initServerInfo');
      wsInit();
    })().catch((error) => {
      bootPromise = undefined;
      throw error;
    });
  }
  return bootPromise;
}

function AppRoutes() {
  useEffect(() => {
    bootApplication().catch((error) => console.error('Failed to initialize application:', error));
  }, []);

  return (
    <Suspense fallback={<div className="grid h-full w-full place-items-center text-[28px] text-[var(--accent-primary)]"><i className="ri-loader-4-line animate-spin" /></div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/server/:id" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div id="app-root" className="h-screen w-full overflow-hidden bg-transparent text-[var(--text-primary)]">
      <AppRoutes />
    </div>
  );
}
