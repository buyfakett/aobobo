import { describe, expect, it, rstest } from '@rstest/core';
import { render } from '@testing-library/react';
import ReactECharts from 'echarts-for-react/lib/core';
import LineChart from '@/components/react/LineChart';
import useMediaQuery from '@/hooks/useMediaQuery';

rstest.mock('echarts-for-react/lib/core', () => ({ default: rstest.fn(() => null) }));
rstest.mock('@/utils/echarts', () => ({ default: {} }));
rstest.mock('@/hooks/useMediaQuery', () => ({ default: rstest.fn(() => false) }));

function option() {
  return rstest.mocked(ReactECharts).mock.calls.at(-1)[0].option;
}

describe('LineChart', () => {
  it('renders an empty chart and honors reduced motion', () => {
    rstest.mocked(useMediaQuery).mockReturnValue(true);
    const { container } = render(<LineChart />);
    expect(option().animation).toBe(false);
    expect(option().series).toEqual([]);
    expect(container.firstElementChild.getAttribute('style')).toContain('220px');
  });

  it('builds accessible chart data with caller axis, colors and tooltip settings', () => {
    const tooltip = rstest.fn();
    const time = new Date(2026, 10, 4, 1, 2, 3).valueOf();
    render(<LineChart height={100} connectNulls className="extra" tooltipFormatter={tooltip}
      yAxis={{ max: 100, axisLabel: { formatter: '{value}%' } }} series={[
        { name: 'CPU', color: 'red', data: [[time, 1], [time + 1000, null]] },
        { id: 'memory', name: 'Mem', lineStyle: { color: 'blue' }, itemStyle: { color: 'green' }, data: [{ value: [time, 2] }] },
        { name: 'empty' },
      ]} />);
    const chart = option();
    expect(chart.tooltip.formatter).toBe(tooltip);
    expect(chart.yAxis.max).toBe(100);
    expect(chart.yAxis.axisLabel.formatter).toBe('{value}%');
    expect(chart.color).toEqual(['red', 'blue']);
    expect(chart.series[0]).toMatchObject({ id: 'CPU', connectNulls: true, data: [[time, 1], [time + 1000, null]] });
    expect(chart.series[1]).toMatchObject({ id: 'memory', lineStyle: { color: 'blue' }, itemStyle: { color: 'green' } });
    expect(chart.xAxis.axisLabel.formatter(time)).toBe('01:02:03');
  });

  it('formats time labels for hourly and multi-day ranges and ignores malformed timestamps', () => {
    const time = new Date(2026, 10, 4, 1, 2, 3).valueOf();
    const { rerender } = render(<LineChart series={[{ name: 'a', data: [[time, 1], [time + 3600000, 2], ['bad', 3]] }]} />);
    expect(option().xAxis.axisLabel.formatter(time)).toBe('01:02');
    rerender(<LineChart series={[{ name: 'a', data: [[time, 1], [time + 172800000, 2]] }]} />);
    expect(option().xAxis.axisLabel.formatter(time)).toBe('11-04\n01:02');
    expect(option().xAxis.splitNumber).toBe(4);
  });
});
