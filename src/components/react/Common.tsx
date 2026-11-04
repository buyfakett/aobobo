import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
    <div className={`theme-mode-switch [display:inline-flex] [align-items:center] [gap:3px] [min-height:40px] [padding:3px] [border:1px_solid_var(--button-subtle-border)] [border-radius:999px] [background:var(--button-subtle-bg)] [box-shadow:inset_0_1px_0_rgba(255,_255,_255,_0.08),_0_8px_16px_rgba(15,_23,_42,_0.04)] [backdrop-filter:blur(18px)_saturate(145%)] max-[768px]:[max-width:100%] max-[768px]:[min-height:32px] max-[768px]:[padding:2px]${compact ? ' theme-mode-switch--compact' : ''}`} role="group" aria-label="主题模式">
      {compact ? (
        <button type="button" className="switch-option [min-width:32px] [height:32px] [display:inline-flex] [align-items:center] [justify-content:center] [padding:0] [line-height:1] [border:1px_solid_transparent] [border-radius:999px] [background:transparent] [color:var(--text-secondary)] [font-size:12px] [font-weight:600] [cursor:pointer] [transition:background_var(--transition-fast),_color_var(--transition-fast),_box-shadow_var(--transition-fast),_border-color_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[flex:0_0_auto] max-[768px]:[min-width:26px] max-[768px]:[height:26px] active" aria-label={`切换主题，当前：${active.label}`} onClick={cycleMode}>
          <i className={active.icon} />
        </button>
      ) : THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`switch-option [min-width:32px] [height:32px] [display:inline-flex] [align-items:center] [justify-content:center] [padding:0] [line-height:1] [border:1px_solid_transparent] [border-radius:999px] [background:transparent] [color:var(--text-secondary)] [font-size:12px] [font-weight:600] [cursor:pointer] [transition:background_var(--transition-fast),_color_var(--transition-fast),_box-shadow_var(--transition-fast),_border-color_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[flex:0_0_auto] max-[768px]:[min-width:26px] max-[768px]:[height:26px]${themeMode === option.value ? ' active' : ''}`}
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
  if (config.aobobo.v1HideNezhaDashboardBtn === true) return null;
  return (
    <a
      href={config.aobobo.v1DashboardUrl || '/dashboard'}
      className="v1-dashboard-btn [display:inline-flex] [align-items:center] [justify-content:center] [gap:5px] [min-height:40px] [padding:0_14px] [border-radius:999px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:12px] [font-weight:600] [line-height:1] [text-decoration:none] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[min-height:32px] max-[768px]:[padding:0_10px] max-[420px]:[width:32px] max-[420px]:[height:32px] max-[420px]:[min-width:32px] max-[420px]:[padding:0]"
      title="访问管理后台"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="ri-dashboard-3-line" />
      <span className="btn-text">管理后台</span>
    </a>
  );
}

export function AppFooter({ className = '' }: { className?: string }) {
  const poweredName = config.aobobo.poweredByName || '哪吒监控';
  const poweredUrl = config.aobobo.poweredByUrl || 'https://nezha.wiki';
  const version = config.aobobo.aoboboVersion || packageJson.version;
  return (
    <footer className={`app-footer [display:flex] [align-items:center] [justify-content:center] [text-align:center] [font-size:11px] [font-family:var(--font-mono)] [color:var(--text-muted)] [background:transparent] [border:none] [border-radius:0] [backdrop-filter:none] [box-shadow:none] ${className}`.trim()}>
      <p className="app-footer__text [margin:0] [padding:0] [line-height:1.4] [display:inline-flex] [align-items:center] [justify-content:center] [flex-wrap:wrap] [gap:0.35em]">
        <span className="app-footer__prefix [opacity:0.8]">Powered by</span>
        <a href={poweredUrl} className="app-footer__link [color:var(--text-secondary)] [text-decoration:none] [transition:color_var(--transition-fast),_opacity_var(--transition-fast)]" target="_blank" rel="noopener noreferrer">{poweredName}</a>
        <span className="app-footer__sep [margin:0_0.15em] [opacity:0.5]" aria-hidden="true">·</span>
        <span className="app-footer__prefix [opacity:0.8]">Theme By</span>
        <a href={config.aobobo.aoboboUrl || 'https://github.com/buyfakett/aobobo'} className="app-footer__link [color:var(--text-secondary)] [text-decoration:none] [transition:color_var(--transition-fast),_opacity_var(--transition-fast)]" target="_blank" rel="noopener noreferrer">buyfakett</a>
        {version && <span className="app-footer__version [opacity:0.8]">v{version}</span>}
      </p>
    </footer>
  );
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function CurrentTime({ panelWidth }: { panelWidth?: number | string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pad = (value) => String(value).padStart(2, '0');
  const style: CSSProperties = {
    '--current-time-second-progress': `${Math.round((now.getSeconds() / 59) * 100)}%`,
    ...(panelWidth ? { '--current-time-panel-width': typeof panelWidth === 'number' ? `${panelWidth}px` : panelWidth } : {}),
  };
  return (
    <div className="current-time-widget [position:absolute] [top:18px] [left:18px] [z-index:10] [width:var(--current-time-panel-width,_236px)] [max-width:calc(100vw_-_36px)] [display:inline-flex] [align-items:stretch] [padding:0] [border-radius:22px] [border:1px_solid_var(--border-color)] [background:linear-gradient(145deg,_rgba(var(--accent-primary-rgb),_0.08),_transparent_42%),_var(--panel-floating-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-md),_inset_0_1px_0_var(--surface-highlight)] [color:var(--text-secondary)] [pointer-events:none] [user-select:none] [overflow:hidden] max-[1023px]:[top:66px] max-[1023px]:[left:14px] max-[1023px]:[width:min(var(--current-time-panel-width,_210px),_210px)] max-[1023px]:[max-width:calc(100vw_-_28px)] max-[1023px]:[border-radius:16px] max-[420px]:[top:62px] max-[420px]:[left:12px] max-[420px]:[width:min(var(--current-time-panel-width,_186px),_186px)] max-[420px]:[max-width:calc(100vw_-_24px)] max-[420px]:[border-radius:14px]" style={style} aria-label="当前时间">
      <div className="current-time-content [position:relative] [z-index:1] [display:flex] [flex-direction:column] [gap:12px] [width:100%] [padding:14px_15px_15px] [line-height:1.2] max-[1023px]:[gap:6px] max-[1023px]:[padding:8px_11px_9px] max-[420px]:[gap:5px] max-[420px]:[padding:6px_9px_7px]">
        <div className="current-time__header [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] max-[420px]:[gap:6px]">
          <div className="current-time__eyebrow [display:inline-flex] [align-items:center] [gap:8px] [min-width:0] [font-size:11px] [font-weight:700] [letter-spacing:0] [color:var(--text-secondary)]"><span className="current-time__indicator [width:16px] [height:16px] [display:grid] [flex:0_0_auto] [place-items:center] [border-radius:8px] [border:1px_solid_rgba(var(--accent-primary-rgb),_0.16)] [background:rgba(var(--accent-primary-rgb),_0.09)] max-[1023px]:[width:12px] max-[1023px]:[height:12px] max-[1023px]:[border-radius:6px]" aria-hidden="true"><span className="current-time__indicator-core [width:7px] [height:7px] [border-radius:50%] [background:var(--accent-primary)] [box-shadow:0_0_0_3px_rgba(var(--accent-primary-rgb),_0.14),_0_0_14px_rgba(var(--accent-primary-rgb),_0.38)] max-[1023px]:[width:5px] max-[1023px]:[height:5px]" /></span><span>当前时间</span></div>
          <span className="current-time__header-meta [white-space:nowrap] [padding-top:1px] max-[420px]:[display:none]">LOCAL</span>
        </div>
        <div className="current-time__main [display:flex] [align-items:center] [justify-content:space-between] [gap:14px]">
          <div className="current-time__clock [flex:1] [min-width:0] [display:flex] [align-items:baseline] [font-size:38px] [font-weight:760] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [color:var(--text-primary)] [line-height:0.88] [letter-spacing:0] max-[1023px]:[font-size:26px] max-[420px]:[font-size:22px]" aria-live="polite"><span>{pad(now.getHours())}</span><span className="current-time__colon [color:var(--accent-primary)] [margin:0_1px] [transform:translateY(-1px)]">:</span><span>{pad(now.getMinutes())}</span></div>
          <div className="current-time__seconds-block [position:relative] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:3px] [width:58px] [min-width:58px] [aspect-ratio:1] [padding:7px] [overflow:hidden] [border-radius:18px] [border:1px_solid_rgba(var(--accent-primary-rgb),_0.17)] [background:linear-gradient(180deg,_rgba(255,_255,_255,_0.08),_transparent),_rgba(var(--accent-primary-rgb),_0.08)] [box-shadow:inset_0_1px_0_var(--surface-highlight),_0_10px_24px_rgba(var(--accent-primary-rgb),_0.12)] max-[1023px]:[width:40px] max-[1023px]:[min-width:40px] max-[1023px]:[padding:4px] max-[1023px]:[border-radius:12px] max-[1023px]:[gap:2px] max-[420px]:[width:34px] max-[420px]:[min-width:34px] max-[420px]:[gap:1px] max-[420px]:[padding:3px] max-[420px]:[border-radius:10px]" aria-label="当前秒数"><span className="current-time__seconds-label">SEC</span><span className="current-time__seconds-value [font-size:20px] [line-height:1] [font-weight:760] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [color:var(--accent-primary)] max-[1023px]:[font-size:15px] max-[420px]:[font-size:13px]">{pad(now.getSeconds())}</span></div>
        </div>
        <div className="current-time__second-track [height:4px] [overflow:hidden] [border-radius:999px] [background:rgba(154,_169,_191,_0.14)] max-[1023px]:[height:2px] max-[420px]:[height:2px]" aria-hidden="true"><span className="current-time__second-progress [display:block] [width:var(--current-time-second-progress)] [height:100%] [border-radius:inherit] [background:linear-gradient(90deg,_var(--accent-primary),_var(--accent-success),_var(--accent-warning))] [box-shadow:0_0_12px_rgba(var(--accent-primary-rgb),_0.24)] [transition:width_0.28s_ease]" /></div>
        <div className="current-time__meta [display:flex] [align-items:flex-end] [justify-content:space-between] [gap:14px] max-[420px]:[gap:5px]">
          <div className="current-time__meta-item [display:flex] [flex-direction:column] [gap:4px] [min-width:0] max-[1023px]:[gap:2px] max-[420px]:[gap:1px]"><span className="current-time__meta-label">DATE</span><span className="current-time__meta-value [font-size:13px] [font-weight:600] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [color:var(--text-secondary)] [white-space:nowrap] [overflow:hidden] [text-overflow:ellipsis] max-[1023px]:[font-size:10px] max-[420px]:[font-size:9px]">{`${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`}</span></div>
          <div className="current-time__meta-item [display:flex] [flex-direction:column] [gap:4px] [min-width:0] max-[1023px]:[gap:2px] max-[420px]:[gap:1px] current-time__meta-item--align-end [align-items:flex-end] [text-align:right]"><span className="current-time__meta-label">WEEK</span><span className="current-time__meta-value [font-size:13px] [font-weight:600] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [color:var(--text-secondary)] [white-space:nowrap] [overflow:hidden] [text-overflow:ellipsis] max-[1023px]:[font-size:10px] max-[420px]:[font-size:9px]">{WEEKDAYS[now.getDay()]}</span></div>
        </div>
      </div>
    </div>
  );
}

type DetailPanelProps = {
  title?: ReactNode;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DetailPanel({ title, icon, actions, children, className = '' }: DetailPanelProps) {
  return (
    <section className={`detail-panel detail-panel--flat [border:1px_solid_var(--border-color)] [border-radius:var(--radius-lg)] [background:var(--section-bg)] [box-shadow:var(--shadow-sm),_inset_0_1px_0_var(--surface-highlight)] [overflow:hidden] max-[768px]:[border-radius:var(--radius-md)] ${className}`.trim()}>
      {(title || actions) && (
        <header className="detail-panel__header module-head-group [display:flex] [flex-wrap:wrap] [align-items:center] [justify-content:space-between] [gap:12px] [margin-bottom:12px]">
          {title && <h2 className="module-title [min-height:28px] [font-size:15px]">{icon && <i className={icon} />}<span>{title}</span></h2>}
          {actions && <div className="module-actions">{actions}</div>}
        </header>
      )}
      <div className="detail-panel__body">{children}</div>
    </section>
  );
}

type ModalProps = {
  open: boolean;
  title: string;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
};

export function Modal({ open, title, onClose, className = '', children }: ModalProps) {
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

export function EmptyState({ icon = 'ri-inbox-line', children }: { icon?: string; children: ReactNode }) {
  return <div className="empty-list [flex:1] [min-height:0] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:8px] [padding:40px_20px] [color:var(--text-muted)] [font-size:13px]"><i className={`${icon} empty-icon`} /><span>{children}</span></div>;
}
