import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import GlobeEarth from '@/components/react/GlobeEarth';
import DetailGlobe from '@/components/react/detail/DetailGlobe';
import echarts from '@/utils/echarts';
import { manageGlobeRendering } from '@/utils/globe-renderer';
import { loadGlobeView, persistGlobeView } from '@/utils/globe-view';
import { createGlobeOceanMap } from '@/utils/globe-textures';
import useMediaQuery from '@/hooks/useMediaQuery';
import type { GlobeEarthHandle } from '@/types/ui';

rs.mock('@/utils/echarts', () => ({ default: { init: rs.fn() } }));
rs.mock('@/utils/echarts-globe', () => ({}));
rs.mock('@/utils/globe-renderer', () => ({ manageGlobeRendering: rs.fn() }));
rs.mock('@/utils/globe-view', () => ({ loadGlobeView: rs.fn(), persistGlobeView: rs.fn() }));
rs.mock('@/hooks/useMediaQuery', () => ({ default: rs.fn() }));
rs.mock('@/components/react/ServerCard', () => ({ default: ({ server, onSelect }) => <button onClick={() => onSelect?.(server)}>{server.Name}</button> }));
rs.mock('@/utils/globe-textures', () => ({
  createGlobeOceanMap: rs.fn(() => ({ toDataURL: () => 'data:image/png;base64,test-texture' })),
  getGlobeRendererPixelRatio: () => 1,
  getPreferredGlobeTextureSize: () => ({ width: 2048, height: 1024 }),
  getLandPolygonsData: () => [{ geometry: { coordinates: [[[0, 0], [10, 10], [0, 0]]] } }],
  THEME_COLORS: {
    dark: { coastline: '#123456', coastlineWidth: 1, mobileCoastline: '#223344', mobileCoastlineWidth: 0.5 },
    light: { coastline: '#abcdef', coastlineWidth: 1, mobileCoastline: '#ccddee', mobileCoastlineWidth: 0.5 },
  },
}));

const locations = [
  { key: 'TYO', code: 'TYO', label: '东京', lat: 35, lng: 139, country: '日本', servers: [{ ID: 1, Name: 'Tokyo', online: 1 }] },
  { key: 'LON', code: 'LON', label: '伦敦', lat: 51, lng: 0, country: '英国', servers: [{ ID: 2, Name: 'London A', online: 1 }, { ID: 3, Name: 'London B', online: -1 }] },
];

beforeEach(() => {
  rs.mocked(loadGlobeView).mockReturnValue(null);
  rs.mocked(useMediaQuery).mockReturnValue(false);
});

function chartFixture(initiallyActive = true) {
  const events = new Map<string, (_params: any) => void>();
  const chart = {
    on: rs.fn((name, callback) => events.set(name, callback)),
    setOption: rs.fn(), dispose: rs.fn(), _componentsViews: [] as any[],
  };
  let active = initiallyActive;
  let activityChanged: (_active: boolean) => void;
  const renderer = {
    isActive: () => active,
    setEnabled: rs.fn((enabled) => { active = enabled; activityChanged(enabled); }),
    setAutoRotate: rs.fn(), dispose: rs.fn(),
  };
  rs.mocked(echarts.init).mockReturnValue(chart as any);
  rs.mocked(manageGlobeRendering).mockImplementation((_chart, _element, callback) => {
    activityChanged = callback;
    callback(active);
    return renderer;
  });
  return {
    chart, renderer,
    click: (params) => act(() => events.get('click')(params)),
    activity: (value) => act(() => { active = value; activityChanged(value); }),
  };
}

describe('homepage globe', () => {
  it('initializes one chart with persisted view, bounded markers, static connections and cached textures', () => {
    const f = chartFixture();
    rs.mocked(loadGlobeView).mockReturnValue({ lat: 20, lng: 30, distance: 180 });
    const many = [1, 2, 5, 10].map((count, index) => ({ ...locations[0], key: `${index}`, servers: Array.from({ length: count }, () => ({ online: index === 0 ? -1 : 1 })) }));
    const { rerender, unmount } = render(<GlobeEarth locations={many} />);
    expect(echarts.init).toHaveBeenCalledWith(expect.any(HTMLElement), undefined, { renderer: 'canvas', devicePixelRatio: 1 });
    const firstOption = f.chart.setOption.mock.calls[0][0];
    expect(firstOption.globe.viewControl).toMatchObject({ targetCoord: [30, 20], distance: 180, autoRotate: true, autoRotateSpeed: 1 });
    expect(firstOption.globe.atmosphere.show).toBe(false);
    const markers = firstOption.series.find((series) => series.id === 'server-markers');
    expect(markers.data.map((marker) => marker.symbolSize)).toEqual([10, 13, 16, 20]);
    expect(markers.symbolSize([], { data: markers.data[3] })).toBe(20);
    expect(markers.data[0].itemStyle.opacity).toBe(0.72);
    expect(markers.data[1].itemStyle.opacity).toBe(1);
    expect(firstOption.series.find((series) => series.id === 'globe-server-connections').effect.show).toBe(false);
    const drawCount = rs.mocked(createGlobeOceanMap).mock.calls.length;
    f.chart.setOption.mockClear();
    rerender(<GlobeEarth locations={many.map((location) => ({ ...location, servers: location.servers.map((server) => ({ ...server, State: { CPU: 99 } })) }))} />);
    expect(f.chart.setOption).not.toHaveBeenCalled();
    rerender(<GlobeEarth locations={many} theme="light" rotateSpeed={1.2} autoRotate={false} showServerConnections={false} />);
    const light = f.chart.setOption.mock.calls.at(-1)[0];
    expect(light.globe.viewControl.autoRotateSpeed).toBe(2.4);
    expect(light.globe.atmosphere.show).toBe(true);
    expect(light.series.find((series) => series.id === 'globe-server-connections').data).toEqual([]);
    expect(light.series.find((series) => series.id === 'server-markers').data[1].itemStyle.color).toBe('#ffae00');
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(rs.mocked(createGlobeOceanMap).mock.calls.length).toBeGreaterThanOrEqual(drawCount);
    unmount();
    expect(f.renderer.dispose).toHaveBeenCalledTimes(1);
    expect(f.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it('selects individual servers or opens a cluster popup and keeps callbacks current', () => {
    const f = chartFixture();
    const onSelect = rs.fn(); const nextSelect = rs.fn();
    const { rerender } = render(<GlobeEarth locations={locations} onSelectServer={onSelect} />);
    f.click({ seriesId: 'other', data: { locationKey: 'TYO' } });
    f.click({ seriesId: 'server-markers' });
    f.click({ seriesId: 'server-markers', data: { locationKey: 'missing' } });
    expect(onSelect).not.toHaveBeenCalled();
    f.click({ seriesId: 'server-markers', data: { locationKey: 'TYO' } });
    expect(onSelect).toHaveBeenCalledWith(locations[0].servers[0]);
    rerender(<GlobeEarth locations={locations} onSelectServer={nextSelect} />);
    f.click({ seriesId: 'server-markers', data: { locationKey: 'TYO' } });
    expect(nextSelect).toHaveBeenCalledWith(locations[0].servers[0]);
    f.click({ seriesId: 'server-markers', data: { locationKey: 'LON' } });
    expect(screen.getByRole('heading', { name: '伦敦' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'London B' }));
    expect(nextSelect).toHaveBeenCalledWith(locations[1].servers[1]);
    fireEvent.click(screen.getByRole('button', { name: '关闭位置弹窗' }));
    expect(screen.queryByRole('heading', { name: '伦敦' })).toBeNull();
  });

  it('exposes focus controls, persists the new view, and removes stale popups', async () => {
    const f = chartFixture();
    const ref = createRef<GlobeEarthHandle>();
    const { rerender, unmount } = render(<GlobeEarth ref={ref} locations={locations} />);
    expect(await ref.current.ready()).toBe(true);
    expect(ref.current.focusLocation(null)).toBe(false);
    await act(async () => { expect(await ref.current.focusLocationWithHighlight(locations[1])).toBe(true); });
    expect(f.renderer.setAutoRotate).toHaveBeenLastCalledWith(false);
    expect(f.chart.setOption).toHaveBeenLastCalledWith({ globe: { viewControl: { targetCoord: [0, 51], distance: 135, autoRotate: false } } });
    expect(persistGlobeView).toHaveBeenCalledWith({ lat: 51, lng: 0, distance: 135 });
    expect(screen.getByRole('heading', { name: '伦敦' })).toBeTruthy();
    act(() => ref.current.clearFocusBubble());
    expect(screen.queryByRole('heading', { name: '伦敦' })).toBeNull();
    await act(async () => { await ref.current.focusLocationWithHighlight(locations[1]); });
    rerender(<GlobeEarth ref={ref} locations={[locations[0]]} />);
    expect(screen.queryByRole('heading', { name: '伦敦' })).toBeNull();
    const handle = ref.current;
    unmount();
    expect(await handle.ready()).toBe(false);
    expect(handle.focusLocation(locations[0])).toBe(false);
  });

  it('queues focus while inactive and applies it after the detail drawer has closed', async () => {
    const f = chartFixture();
    const ref = createRef<GlobeEarthHandle>();
    const { rerender } = render(<GlobeEarth ref={ref} locations={locations} active={false} />);
    f.chart.setOption.mockClear();
    await act(async () => { expect(await ref.current.focusLocationWithHighlight(locations[1])).toBe(true); });
    expect(f.chart.setOption).not.toHaveBeenCalled();
    rerender(<GlobeEarth ref={ref} locations={locations} active />);
    expect(f.chart.setOption).toHaveBeenLastCalledWith({ globe: { viewControl: { targetCoord: [0, 51], distance: 135, autoRotate: false } } });
    expect(screen.getByRole('heading', { name: '伦敦' })).toBeTruthy();
  });

  it('debounces camera persistence after dragging and preserves live view across option changes', () => {
    rs.useFakeTimers();
    const f = chartFixture();
    const { container, rerender, unmount } = render(<GlobeEarth locations={locations} />);
    f.chart._componentsViews = [{ _control: { getAlpha: () => 12, getBeta: () => 450, getDistance: () => 270 } }];
    fireEvent.pointerUp(container.firstElementChild);
    act(() => rs.advanceTimersByTime(400));
    fireEvent.wheel(container.firstElementChild);
    act(() => rs.advanceTimersByTime(799));
    expect(persistGlobeView).not.toHaveBeenCalled();
    act(() => rs.advanceTimersByTime(1));
    expect(persistGlobeView).toHaveBeenCalledWith({ lat: 12, lng: 0, distance: 170 });
    rerender(<GlobeEarth locations={locations} autoRotate={false} />);
    expect(f.chart.setOption.mock.calls.at(-1)[0].globe.viewControl).toMatchObject({ targetCoord: [0, 12], distance: 170, autoRotate: false });
    f.chart._componentsViews[0]._control.getDistance = () => 50;
    fireEvent.pointerCancel(container.firstElementChild);
    act(() => rs.advanceTimersByTime(800));
    expect(persistGlobeView).toHaveBeenCalledTimes(1);
    fireEvent.wheel(container.firstElementChild);
    unmount();
    expect(rs.getTimerCount()).toBe(0);
  });

  it('uses mobile atmosphere and view distance and reports chart initialization failures', () => {
    const f = chartFixture();
    rs.mocked(useMediaQuery).mockReturnValue(true);
    const { unmount } = render(<GlobeEarth locations={locations} />);
    expect(f.chart.setOption.mock.calls[0][0].globe).toMatchObject({ atmosphere: { offset: 1.2 }, viewControl: { distance: 185 } });
    unmount();
    const error = new Error('WebGL unavailable');
    rs.mocked(echarts.init).mockImplementation(() => { throw error; });
    const log = rs.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobeEarth locations={[]} />);
    expect(screen.getByText('地球初始化失败，请刷新重试')).toBeTruthy();
    expect(log).toHaveBeenCalledWith('Failed to initialize globe:', error);
  });
});

describe('detail globe', () => {
  it('renders a location marker, updates options without recreating the chart, and releases resources', () => {
    const f = chartFixture();
    const { rerender, unmount } = render(<DetailGlobe location={{ lat: 35, lng: 139 }} />);
    const option = f.chart.setOption.mock.calls[0][0];
    expect(option.globe.viewControl).toMatchObject({ targetCoord: [139, 35], distance: 190, autoRotate: false });
    expect(option.series.find((series) => series.id === 'detail-globe-marker').data[0].value).toEqual([139, 35, 0.05]);
    expect(f.chart.setOption.mock.calls[0][1]).toEqual({ notMerge: true, lazyUpdate: false });
    rerender(<DetailGlobe location={{ lat: 0, lng: 10 }} theme="light" />);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(f.chart.setOption.mock.calls.at(-1)[0].globe.light.ambient.intensity).toBe(1.4);
    expect(f.chart.setOption.mock.calls.at(-1)[0].globe.viewControl.targetCoord).toEqual([10, 0]);
    unmount();
    expect(f.renderer.dispose).toHaveBeenCalledTimes(1);
    expect(f.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it('shows a placeholder for invalid coordinates and defers updates until visible', () => {
    const f = chartFixture(false);
    const { container, rerender } = render(<DetailGlobe location={{ lat: 'bad', lng: 1 }} />);
    expect(container.querySelector('.server-detail-globe__placeholder')).not.toBeNull();
    expect(echarts.init).not.toHaveBeenCalled();
    rerender(<DetailGlobe location={{ lat: 1, lng: 2 }} />);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(f.chart.setOption).not.toHaveBeenCalled();
    f.activity(true);
    expect(f.chart.setOption).toHaveBeenCalledTimes(1);
    rerender(<DetailGlobe location={{ lat: 1, lng: 2 }} />);
    expect(f.chart.setOption).toHaveBeenCalledTimes(1);
    rerender(<DetailGlobe location={null} />);
    expect(f.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it('logs initialization failures without crashing the surrounding detail page', () => {
    const error = new Error('no WebGL');
    rs.mocked(echarts.init).mockImplementation(() => { throw error; });
    const log = rs.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<DetailGlobe location={{ lat: 1, lng: 2 }} />)).not.toThrow();
    expect(log).toHaveBeenCalledWith('Failed to initialize detail globe:', error);
  });
});
