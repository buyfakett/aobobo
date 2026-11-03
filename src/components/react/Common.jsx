import { useEffect, useState } from 'react';
import config from '@/config';
import store, { useStore } from '@/store';
import { THEME_MODES } from '@/utils/theme';
import useMediaQuery from '@/hooks/useMediaQuery';
import packageJson from '../../../package.json';

const THEME_OPTIONS = [
  { value: THEME_MODES.AUTO, label: 'Auto', icon: 'ri-computer-line' },
  { value: THEME_MODES.LIGHT, label: 'Light', icon: 'ri-sun-line' },
  { value: THEME_MODES.DARK, label: 'Dark', icon: 'ri-moon-line' },
];

export function ThemeModeSwitch() {
  const themeMode = useStore((state) => state.themeMode);
  const compact = useMediaQuery('(max-width: 420px)');
  const active = THEME_OPTIONS.find((option) => option.value === themeMode) || THEME_OPTIONS[0];

  function setMode(mode) {
    if (mode !== themeMode) store.dispatch('setThemeMode', mode);
  }

  function cycleMode() {
    const index = THEME_OPTIONS.findIndex((option) => option.value === themeMode);
    setMode(THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length].value);
  }

  return (
    <div className={`theme-mode-switch${compact ? ' theme-mode-switch--compact' : ''}`} role="group" aria-label="主题模式">
      {compact ? (
        <button type="button" className="switch-option active" aria-label={`切换主题，当前：${active.label}`} onClick={cycleMode}>
          <i className={active.icon} />
        </button>
      ) : THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`switch-option${themeMode === option.value ? ' active' : ''}`}
          onClick={() => setMode(option.value)}
        >
          <i className={option.icon} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DashboardButton() {
  const username = useStore((state) => state.profile?.username);
  if (config.aobobo.v1HideNezhaDashboardBtn === true) return null;
  return (
    <a
      href={config.aobobo.v1DashboardUrl || '/dashboard'}
      className="v1-dashboard-btn"
      title={username ? '访问管理后台' : '登录管理后台'}
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className={username ? 'ri-dashboard-3-line' : 'ri-user-line'} />
      <span className="btn-text">{username ? '管理后台' : '登录'}</span>
    </a>
  );
}

export function AppFooter({ className = '' }) {
  const poweredName = config.aobobo.poweredByName || '哪吒监控';
  const poweredUrl = config.aobobo.poweredByUrl || 'https://nezha.wiki';
  const version = config.aobobo.aoboboVersion || packageJson.version;
  return (
    <footer className={`app-footer ${className}`.trim()}>
      <p className="app-footer__text">
        <span className="app-footer__prefix">Powered by</span>
        <a href={poweredUrl} className="app-footer__link" target="_blank" rel="noopener noreferrer">{poweredName}</a>
        <span className="app-footer__sep" aria-hidden="true">·</span>
        <span className="app-footer__prefix">Theme By</span>
        <a href={config.aobobo.aoboboUrl || 'https://github.com/buyfakett/aobobo'} className="app-footer__link" target="_blank" rel="noopener noreferrer">buyfakett</a>
        {version && <span className="app-footer__version">v{version}</span>}
      </p>
    </footer>
  );
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function CurrentTime({ panelWidth }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pad = (value) => String(value).padStart(2, '0');
  const style = {
    '--current-time-second-progress': `${Math.round((now.getSeconds() / 59) * 100)}%`,
    ...(panelWidth ? { '--current-time-panel-width': typeof panelWidth === 'number' ? `${panelWidth}px` : panelWidth } : {}),
  };
  return (
    <div className="current-time-widget" style={style} aria-label="当前时间">
      <div className="current-time-content">
        <div className="current-time__header">
          <div className="current-time__eyebrow"><span className="current-time__indicator" aria-hidden="true"><span className="current-time__indicator-core" /></span><span>当前时间</span></div>
          <span className="current-time__header-meta">LOCAL</span>
        </div>
        <div className="current-time__main">
          <div className="current-time__clock" aria-live="polite"><span>{pad(now.getHours())}</span><span className="current-time__colon">:</span><span>{pad(now.getMinutes())}</span></div>
          <div className="current-time__seconds-block" aria-label="当前秒数"><span className="current-time__seconds-label">SEC</span><span className="current-time__seconds-value">{pad(now.getSeconds())}</span></div>
        </div>
        <div className="current-time__second-track" aria-hidden="true"><span className="current-time__second-progress" /></div>
        <div className="current-time__meta">
          <div className="current-time__meta-item"><span className="current-time__meta-label">DATE</span><span className="current-time__meta-value">{`${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`}</span></div>
          <div className="current-time__meta-item current-time__meta-item--align-end"><span className="current-time__meta-label">WEEK</span><span className="current-time__meta-value">{WEEKDAYS[now.getDay()]}</span></div>
        </div>
      </div>
    </div>
  );
}

export function DetailPanel({ title, icon, actions, children, className = '' }) {
  return (
    <section className={`detail-panel detail-panel--flat ${className}`.trim()}>
      {(title || actions) && (
        <header className="detail-panel__header module-head-group">
          {title && <h2 className="module-title">{icon && <i className={icon} />}<span>{title}</span></h2>}
          {actions && <div className="module-actions">{actions}</div>}
        </header>
      )}
      <div className="detail-panel__body">{children}</div>
    </section>
  );
}

export function Modal({ open, title, onClose, className = '', children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && onClose?.();
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="react-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`react-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="react-modal__header"><h2>{title}</h2><button type="button" className="react-modal__close" aria-label="关闭" onClick={onClose}><i className="ri-close-line" /></button></header>
        <div className="react-modal__body">{children}</div>
      </section>
    </div>
  );
}

export function EmptyState({ icon = 'ri-inbox-line', children }) {
  return <div className="empty-list"><i className={`${icon} empty-icon`} /><span>{children}</span></div>;
}
