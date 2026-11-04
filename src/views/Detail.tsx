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
    <div className="detail-view">
      <div className={`detail-main${info.online === 1 ? '' : ' server--offline'}`}>
        <div className="status-bar"><div className="status-group"><button type="button" className="back-btn" onClick={() => navigate(-1)}><i className="ri-arrow-left-line" /><span className="back-btn__text">返回</span></button><h1 className="detail-title">{info.Name || '服务器详情'}</h1></div><div className="status-actions"><DashboardButton /><ThemeModeSwitch /></div></div>
        <div className="detail-stack"><DetailContent key={info.ID} info={info} /></div>
        <AppFooter className="detail-footer" />
      </div>
    </div>
  );
}
