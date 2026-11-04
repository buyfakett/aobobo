import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import config from '@/config';
import store, { useStore } from '@/store';
import { AppFooter, DashboardButton, ThemeModeSwitch } from '@/components/react/Common';
import DetailContent from '@/components/react/detail/DetailContent';

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const appState = useStore((state) => state);
  const info = appState.serverList.find((server) => String(server.ID) === String(id));

  useEffect(() => {
    if (info?.Name) document.title = `${info.Name} · 哪吒监控`;
    return () => { document.title = config.aobobo.title || '哪吒监控'; };
  }, [info?.Name]);

  useEffect(() => {
    if (appState.init && !info) navigate('/', { replace: true });
  }, [appState.init, info, navigate]);

  useEffect(() => {
    if (!appState.init || !appState.showAvailability) return undefined;
    store.dispatch('refreshAvailability');
    const seconds = Number(config.aobobo.availabilityRefreshTime);
    if (!seconds || seconds <= 0) return undefined;
    const timer = window.setInterval(() => store.dispatch('refreshAvailability'), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [appState.init, appState.showAvailability]);

  if (!info) return <div className="grid h-full w-full place-items-center text-[28px] text-[var(--accent-primary)]"><i className="ri-loader-4-line animate-spin" /></div>;
  return (
    <div className="detail-view [position:relative] [width:100%] [height:100dvh] [padding:0] [overflow:hidden] [background:var(--page-bg)] max-[768px]:[padding:0]">
      <div className={`detail-main [min-height:0] [height:100%] [overflow-y:auto] [width:100%] [position:relative] [z-index:1]${info.online === 1 ? '' : ' server--offline'}`}>
        <div className="status-bar [display:flex] [align-items:center] [justify-content:space-between] [flex-wrap:wrap] [gap:10px_14px] [padding:8px_14px] [position:relative] [overflow:hidden] [background:var(--status-bar-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [border:1px_solid_var(--border-color)] [border-radius:calc(var(--radius-lg)_+_2px)] [box-shadow:var(--shadow-sm),_inset_0_1px_0_var(--surface-highlight)] [z-index:10] min-[1024px]:[grid-column:2/3] min-[1024px]:[grid-row:1/2] max-[1023px]:[padding:8px_10px] max-[1023px]:[gap:8px_10px] max-[1023px]:[font-size:12px] max-[1023px]:[border-radius:20px] max-[1023px]:[flex-wrap:nowrap] max-[1023px]:[align-items:center] max-[1023px]:[position:absolute] max-[1023px]:[top:10px] max-[1023px]:[left:10px] max-[1023px]:[right:10px] max-[1023px]:[z-index:20] max-[420px]:[padding:8px_10px] max-[420px]:[gap:8px] max-[420px]:[flex-wrap:nowrap] max-[420px]:[align-items:center]"><div className="status-group"><button type="button" className="back-btn" onClick={() => navigate(-1)}><i className="ri-arrow-left-line" /><span className="back-btn__text">返回</span></button><h1 className="detail-title">{info.Name || '服务器详情'}</h1></div><div className="status-actions"><DashboardButton /><ThemeModeSwitch /></div></div>
        <div className="detail-stack [display:flex] [flex-direction:column] [gap:10px] [width:calc(100%_-_28px)] [max-width:800px] [margin:0_auto] [padding-bottom:2px] max-[768px]:[gap:6px] max-[768px]:[width:calc(100%_-_24px)] max-[768px]:[margin:0_12px] max-[768px]:[padding-bottom:24px]"><DetailContent key={info.ID} info={info} /></div>
        <AppFooter className="detail-footer [width:calc(100%_-_28px)] [max-width:800px] [margin:12px_auto_6px] [padding:0_16px] max-[768px]:[width:calc(100%_-_24px)] max-[768px]:[margin:8px_12px_24px] max-[768px]:[padding:0_12px]" />
      </div>
    </div>
  );
}
