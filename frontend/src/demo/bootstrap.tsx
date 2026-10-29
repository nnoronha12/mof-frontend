import React from 'react';
import { createRoot } from 'react-dom/client';

const App = React.lazy(() => import('./index'));
const arabic = (() => {
  try { return (localStorage.getItem('i18nextLng') || document.documentElement.lang || navigator.language).startsWith('ar'); }
  catch { return document.documentElement.lang.startsWith('ar'); }
})();

class PortalBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" dir={arabic ? 'rtl' : 'ltr'} style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <p>{arabic ? 'تعذّر تحميل البوابة. أعد تحميل الصفحة للمحاولة مرة أخرى.' : 'The portal could not load. Reload the page to try again.'}</p>
      <button type="button" onClick={() => window.location.reload()}>{arabic ? 'إعادة التحميل' : 'Reload'}</button>
    </div>;
  }
}

const container = document.getElementById('root');
if (container) createRoot(container).render(
  <PortalBoundary><React.Suspense fallback={<p role="status" dir={arabic ? 'rtl' : 'ltr'} style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>{arabic ? 'جاري التحميل…' : 'Loading…'}</p>}>
    <App />
  </React.Suspense></PortalBoundary>,
);
