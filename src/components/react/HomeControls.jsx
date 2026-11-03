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
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [{ label: '全部', value: '' }, { label: '在线', value: '1' }, { label: '离线', value: '-1' }];
  useOutsideClose(ref, open, () => setOpen(false));
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <div ref={ref} className="server-status-filter">
      <button type="button" className={`status-filter-trigger${open ? ' active' : ''}`} onClick={() => setOpen((state) => !state)}><span className="status-filter-label">{selected.label}</span><i className="ri-arrow-down-s-line" /></button>
      {open && <div className="status-filter-dropdown">{options.map((option) => <button key={option.value || 'all'} type="button" className={`status-filter-option${value === option.value ? ' active' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}
    </div>
  );
}

export function SortSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, open, () => setOpen(false));
  const label = options.find((option) => option.value === value.prop)?.label || '排序';
  return (
    <div ref={ref} className="server-sort-select">
      <button type="button" className="sort-trigger" onClick={() => setOpen((state) => !state)}><span className="sort-label">{label}</span><span className="sort-order" role="button" tabIndex={0} title="切换升序/降序" onClick={(event) => { event.stopPropagation(); onChange({ ...value, order: value.order === 'desc' ? 'asc' : 'desc' }); }}><i className={value.order === 'desc' ? 'ri-arrow-down-line' : 'ri-arrow-up-line'} /></span></button>
      {open && <div className="sort-dropdown">{options.map((option) => <button key={option.value} type="button" className={`sort-option${value.prop === option.value ? ' active' : ''}`} onClick={() => { onChange({ prop: value.prop === option.value ? 'DisplayIndex' : option.value, order: value.order }); setOpen(false); }}>{option.label}</button>)}</div>}
    </div>
  );
}

export function GlobeControls({ autoRotate, speed, connections, onAutoRotate, onSpeed, onConnections }) {
  const progress = ((speed - MIN_ROTATE_SPEED) / (MAX_ROTATE_SPEED - MIN_ROTATE_SPEED)) * 100;
  return (
    <>
      <div className={`globe-rotation-control is-embedded${autoRotate ? '' : ' is-paused'}`} role="group" aria-label="地球自转控制">
        <button type="button" className={`rotation-toggle${autoRotate ? ' is-active' : ''}`} aria-pressed={autoRotate} title={autoRotate ? '关闭自转' : '开启自转'} onClick={() => onAutoRotate(!autoRotate)}><i className={autoRotate ? 'ri-pause-mini-fill' : 'ri-play-mini-fill'} /><span>{autoRotate ? '自转中' : '已暂停'}</span></button>
        <div className="rotation-speed-slot"><div className="rotation-speed"><i className="ri-speed-line" /><input className="rotation-speed__range" type="range" min={MIN_ROTATE_SPEED} max={MAX_ROTATE_SPEED} step={ROTATE_SPEED_STEP} value={speed} disabled={!autoRotate} style={{ '--speed-progress': `${progress}%` }} onChange={(event) => onSpeed(clampRotateSpeed(event.target.value))} /><span className="rotation-speed__value">{Number(speed).toFixed(1)}x</span></div></div>
      </div>
      <div className="globe-effects-control"><button type="button" className={`effect-toggle${connections ? ' is-active' : ''}`} aria-pressed={connections} title={connections ? '隐藏服务器连线' : '显示服务器连线'} onClick={() => onConnections(!connections)}><i className="ri-node-tree" /><span>连线</span></button></div>
    </>
  );
}
