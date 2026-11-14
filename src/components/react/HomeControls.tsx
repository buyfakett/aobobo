import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import {
  MAX_ROTATE_SPEED,
  MIN_ROTATE_SPEED,
  ROTATE_SPEED_STEP,
  clampRotateSpeed,
} from '@/utils/globe-rotation';

function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => !ref.current?.contains(event.target) && close();
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [close, open, ref]);
}

export function StatusFilter({ value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [{ label: '全部', value: '' }, { label: '在线', value: '1' }, { label: '离线', value: '-1' }];
  useOutsideClose(ref, open, () => setOpen(false));
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <div ref={ref} className="server-status-filter [position:relative] [flex:0_0_auto]">
      <button type="button" className={`status-filter-trigger [display:inline-flex] [align-items:center] [justify-content:center] [gap:3px] [min-height:32px] [padding:0_6px_0_8px] [border-radius:999px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:11px] [line-height:1] [font-weight:600] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast)] [box-shadow:inset_0_1px_0_rgba(255,_255,_255,_0.08),_0_4px_10px_rgba(15,_23,_42,_0.03)]${open ? ' active' : ''}`} onClick={() => setOpen((state) => !state)}><span className="status-filter-label [white-space:nowrap] [line-height:1]">{t(selected.label)}</span><i className="ri-arrow-down-s-line" /></button>
      {open && <div className="status-filter-dropdown [position:absolute] [top:calc(100%_+_6px)] [right:0] [z-index:200] [min-width:110px] [max-height:260px] [overflow-y:auto] [padding:6px] [border-radius:12px] [border:1px_solid_var(--border-color)] [background:var(--section-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-md)] [display:flex] [flex-direction:column] [gap:2px]">{options.map((option) => <button key={option.value || 'all'} type="button" className={`status-filter-option [display:inline-flex] [align-items:center] [gap:7px] [min-height:32px] [padding:0_10px] [border-radius:8px] [border:1px_solid_transparent] [background:transparent] [color:var(--text-secondary)] [font-size:12px] [font-weight:600] [line-height:1] [text-align:left] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast)]${value === option.value ? ' active' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }}>{t(option.label)}</button>)}</div>}
    </div>
  );
}

export function SortSelect({ value, options, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, open, () => setOpen(false));
  const label = options.find((option) => option.value === value.prop)?.label || t('排序');
  return (
    <div ref={ref} className="server-sort-select [position:relative] [flex:0_0_auto]">
      <button type="button" className="sort-trigger [display:inline-flex] [align-items:center] [justify-content:center] [gap:3px] [min-height:34px] [padding:0_8px_0_10px] [border-radius:999px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:12px] [line-height:1] [font-weight:600] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast)]" onClick={() => setOpen((state) => !state)}><span className="sort-label [white-space:nowrap]">{label}</span><span className="sort-order [display:inline-flex] [align-items:center] [justify-content:center] [width:18px] [height:18px] [border-radius:5px] [transition:background_var(--transition-fast)]" role="button" tabIndex={0} title={t('切换升序/降序')} onClick={(event) => { event.stopPropagation(); onChange({ ...value, order: value.order === 'desc' ? 'asc' : 'desc' }); }}><i className={value.order === 'desc' ? 'ri-arrow-down-line' : 'ri-arrow-up-line'} /></span></button>
      {open && <div className="sort-dropdown [position:absolute] [top:calc(100%_+_6px)] [right:0] [z-index:200] [min-width:140px] [max-height:260px] [overflow-y:auto] [padding:6px] [border-radius:12px] [border:1px_solid_var(--border-color)] [background:var(--section-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-md)] [display:flex] [flex-direction:column] [gap:2px]">{options.map((option) => <button key={option.value} type="button" className={`sort-option [display:flex] [align-items:center] [min-height:32px] [padding:0_10px] [border-radius:8px] [border:1px_solid_transparent] [background:transparent] [color:var(--text-secondary)] [font-size:12px] [font-weight:600] [text-align:left] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast)]${value.prop === option.value ? ' active' : ''}`} onClick={() => { onChange({ prop: value.prop === option.value ? 'DisplayIndex' : option.value, order: value.order }); setOpen(false); }}>{t(option.label)}</button>)}</div>}
    </div>
  );
}

export function GlobeControls({ autoRotate, speed, connections, onAutoRotate, onSpeed, onConnections }) {
  const { t } = useTranslation();
  const progress = ((speed - MIN_ROTATE_SPEED) / (MAX_ROTATE_SPEED - MIN_ROTATE_SPEED)) * 100;
  return (
    <>
      <div className={`globe-rotation-control [display:inline-flex] [align-items:center] [gap:8px] [padding:6px_8px_6px_6px] [border-radius:999px] [border:1px_solid_var(--border-color)] [background:linear-gradient(145deg,_rgba(var(--accent-primary-rgb),_0.08),_transparent_48%),_var(--panel-floating-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-md),_inset_0_1px_0_var(--surface-highlight)] [pointer-events:auto] [transition:gap_0.28s_ease,_padding_0.28s_ease] max-[768px]:[gap:6px] max-[768px]:[padding:5px_7px_5px_5px] is-embedded${autoRotate ? '' : ' is-paused'}`} role="group" aria-label={t('地球自转控制')}>
        <button type="button" className={`rotation-toggle [display:inline-flex] [align-items:center] [gap:5px] [flex:0_0_auto] [min-height:30px] [padding:0_10px_0_8px] [border-radius:999px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:11px] [font-weight:600] [cursor:pointer] [transition:background_var(--transition-fast),_color_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast)] max-[768px]:[min-height:28px] max-[768px]:[padding:0_8px_0_6px] max-[768px]:[font-size:10.5px]${autoRotate ? ' is-active' : ''}`} aria-pressed={autoRotate} title={t(autoRotate ? '关闭自转' : '开启自转')} onClick={() => onAutoRotate(!autoRotate)}><i className={autoRotate ? 'ri-pause-mini-fill' : 'ri-play-mini-fill'} /><span>{t(autoRotate ? '自转中' : '已暂停')}</span></button>
        <div className="rotation-speed-slot [display:grid] [grid-template-columns:1fr] [min-width:0] [max-width:148px] [opacity:1] [overflow:hidden] [transition:max-width_0.28s_ease,_opacity_0.22s_ease,_transform_0.28s_ease] [transform-origin:left_center] max-[768px]:[max-width:128px]"><div className="rotation-speed [display:inline-flex] [align-items:center] [gap:6px] [min-width:max-content] [padding-right:2px] [color:var(--text-secondary)]"><i className="ri-speed-line" /><input aria-label={t('自转速度')} className="rotation-speed__range [width:84px] [height:18px] [margin:0] [appearance:none] [background:transparent] [cursor:pointer] max-[768px]:[width:72px]" type="range" min={MIN_ROTATE_SPEED} max={MAX_ROTATE_SPEED} step={ROTATE_SPEED_STEP} value={speed} disabled={!autoRotate} style={{ '--speed-progress': `${progress}%` }} onChange={(event) => onSpeed(clampRotateSpeed(event.target.value))} /><span className="rotation-speed__value [min-width:2.4em] [font-family:var(--font-mono)] [font-size:11px] [font-variant-numeric:tabular-nums] [font-weight:600] [color:var(--text-primary)] [text-align:right] max-[768px]:[min-width:2.2em] max-[768px]:[font-size:10.5px]">{Number(speed).toFixed(1)}x</span></div></div>
      </div>
      <div className="globe-effects-control [display:flex] [align-items:center] [flex:0_0_auto] [gap:6px] [pointer-events:auto] max-[768px]:[gap:5px]"><button type="button" className={`effect-toggle [display:inline-flex] [align-items:center] [gap:4px] [flex:0_0_auto] [min-height:22px] [padding:0_6px] [border-radius:8px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:11px] [font-weight:600] [line-height:1] [cursor:pointer] [opacity:0.55] [transition:opacity_var(--transition-fast),_background_var(--transition-fast),_color_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast)] max-[768px]:[min-height:20px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10.5px] max-[768px]:[gap:3px]${connections ? ' is-active' : ''}`} aria-pressed={connections} title={t(connections ? '隐藏服务器连线' : '显示服务器连线')} onClick={() => onConnections(!connections)}><i className="ri-node-tree" /><span>{t('连线')}</span></button></div>
    </>
  );
}
