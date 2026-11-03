import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

export default function LineChart({
  series = [],
  height = 220,
  connectNulls = false,
  yAxis = {},
  tooltipFormatter,
  className = '',
}) {
  const option = useMemo(() => {
    const timestamps = series.flatMap((item) => (item.data || []))
      .map((point) => Number(Array.isArray(point) ? point[0] : point?.value?.[0]))
      .filter(Number.isFinite);
    const timeSpan = timestamps.length > 1
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : 0;
    const isRealtimeSpan = timeSpan <= 10 * 60 * 1000;
    const formatTime = (value) => {
      const date = new Date(value);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      if (isRealtimeSpan) return `${hours}:${minutes}:${seconds}`;
      if (timeSpan <= 24 * 60 * 60 * 1000) return `${hours}:${minutes}`;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}\n${hours}:${minutes}`;
    };

    return {
    animation: false,
    color: series.map((item) => item.color || item.lineStyle?.color).filter(Boolean),
    grid: {
      top: 12,
      right: 10,
      bottom: timeSpan > 24 * 60 * 60 * 1000 ? 10 : 8,
      left: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'var(--bg-card-strong)',
      borderColor: 'var(--border-color)',
      textStyle: { color: 'var(--text-primary)', fontSize: 12 },
      formatter: tooltipFormatter,
    },
    xAxis: {
      type: 'time',
      splitNumber: isRealtimeSpan ? 3 : 4,
      axisLine: { lineStyle: { color: 'var(--border-color)' } },
      axisLabel: {
        color: 'var(--text-muted)',
        fontSize: 10,
        hideOverlap: true,
        margin: 9,
        formatter: formatTime,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'var(--text-muted)', fontSize: 10, ...yAxis.axisLabel },
      splitLine: { show: false },
      ...yAxis,
    },
    series: series.map((item) => ({
      id: item.id || item.name,
      name: item.name,
      type: 'line',
      data: item.data || [],
      showSymbol: false,
      smooth: 0.18,
      connectNulls,
      lineStyle: { width: 1.8, color: item.color || item.lineStyle?.color },
      itemStyle: { color: item.color || item.itemStyle?.color },
      emphasis: { focus: 'series' },
    })),
    };
  }, [connectNulls, series, tooltipFormatter, yAxis]);

  return (
    <div className={`line-box w-full ${className}`.trim()} style={{ height }}>
      <ReactECharts
        className="chart h-full w-full"
        option={option}
        notMerge
        lazyUpdate
        opts={{ renderer: 'canvas' }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
