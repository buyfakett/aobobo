import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import DetailHeader from '@/components/react/detail/DetailHeader';
import DetailStatus from '@/components/react/detail/DetailStatus';
import ResourceHistory from '@/components/react/detail/ResourceHistory';
import CycleTransfer from '@/components/react/detail/CycleTransfer';
import ServerInfo from '@/components/react/detail/ServerInfo';
import NetworkMonitor from '@/components/react/detail/NetworkMonitor';
import OnlineHistory from '@/components/react/detail/OnlineHistory';
import type { AnyCallback } from '@/types/ui';

const TABS = [
  { value: 'overview', label: '概览', icon: 'ri-dashboard-3-line' },
  { value: 'online', label: '在线历史', icon: 'ri-history-line' },
];

export default function DetailContent({ info, initialTab = 'overview', onTabChange }: {
  info: any;
  initialTab?: string;
  onTabChange?: AnyCallback;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(initialTab);
  const selectTab = (value) => {
    setTab(value);
    onTabChange?.(value);
  };
  return (
    <div className="detail-content-stack [display:flex] [flex-direction:column] [gap:12px] max-[768px]:[gap:8px]">
      <DetailHeader info={info} />
      <div className="detail-view-switch" role="tablist" aria-label={t('服务器详情视图')}>
        {TABS.map((item) => <button key={item.value} type="button" role="tab" className={`detail-view-switch__item${tab === item.value ? ' active' : ''}`} aria-selected={tab === item.value} onClick={() => selectTab(item.value)}><i className={item.icon} /><span>{t(item.label)}</span></button>)}
      </div>
      {tab === 'overview' ? <><DetailStatus info={info} /><ResourceHistory info={info} /><CycleTransfer info={info} /><ServerInfo info={info} /><NetworkMonitor info={info} /></> : <OnlineHistory info={info} />}
    </div>
  );
}
