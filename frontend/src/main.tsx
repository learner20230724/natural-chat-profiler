import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import UserPage from './pages/UserPage.tsx';
import { AppProvider } from './context/AppContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

function Wrapped({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AppProvider>{children}</AppProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Wrapped><App /></Wrapped>} />
        <Route path="/user" element={<Wrapped><UserPage /></Wrapped>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
