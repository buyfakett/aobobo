import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/utils/echarts';
import type { AnyCallback } from '@/types/ui';
import useMediaQuery from '@/hooks/useMediaQuery';

const EMPTY_SERIES: any[] = [];
const EMPTY_Y_AXIS: Record<string, any> = {};
const CHART_OPTIONS = { renderer: 'canvas' } as const;
const CHART_STYLE = { height: '100%', width: '100%' };

type LineChartProps = {
  series?: any[];
  height?: number;
  connectNulls?: boolean;
  yAxis?: Record<string, any>;
  tooltipFormatter?: AnyCallback;
  className?: string;
};

const LineChart = memo(function LineChart({
  series = EMPTY_SERIES,
  height = 220,
  connectNulls = false,
  yAxis = EMPTY_Y_AXIS,
  tooltipFormatter,
  className = '',
}: LineChartProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const timeSpan = useMemo(() => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const item of series) {
      for (const point of item.data || EMPTY_SERIES) {
        const timestamp = Number(Array.isArray(point) ? point[0] : point?.value?.[0]);
        if (!Number.isFinite(timestamp)) continue;
        minimum = Math.min(minimum, timestamp);
        maximum = Math.max(maximum, timestamp);
      }
    }
    return Number.isFinite(minimum) ? maximum - minimum : 0;
  }, [series]);
  const isRealtimeSpan = timeSpan <= 10 * 60 * 1000;
  const isMultiDaySpan = timeSpan > 24 * 60 * 60 * 1000;
  // Stable formatters let echarts-for-react skip identical data received again.
  const formatTime = useMemo(() => (value) => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    if (isRealtimeSpan) return `${hours}:${minutes}:${seconds}`;
    if (!isMultiDaySpan) return `${hours}:${minutes}`;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}\n${hours}:${minutes}`;
  }, [isMultiDaySpan, isRealtimeSpan]);

  const option = useMemo(() => ({
    animation: !reduceMotion,
    animationDuration: 520,
    // Draw each incoming sample once rather than animating every refresh.
    animationDurationUpdate: 0,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    color: series.map((item) => item.color || item.lineStyle?.color).filter(Boolean),
    grid: {
      top: 12,
      right: 10,
      bottom: isMultiDaySpan ? 10 : 8,
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
      data: item.data || EMPTY_SERIES,
      showSymbol: false,
      smooth: 0.18,
      connectNulls,
      lineStyle: { width: 1.8, color: item.color || item.lineStyle?.color },
      itemStyle: { color: item.color || item.itemStyle?.color },
      emphasis: { focus: 'series' },
    })),
  }), [connectNulls, formatTime, isMultiDaySpan, isRealtimeSpan, reduceMotion, series, tooltipFormatter, yAxis]);

  return (
    <div className={`line-box w-full ${className}`.trim()} style={{ height }}>
      <ReactECharts
        echarts={echarts}
        className="chart h-full w-full"
        option={option}
        notMerge={false}
        lazyUpdate
        opts={CHART_OPTIONS}
        style={CHART_STYLE}
      />
    </div>
  );
});

export default LineChart;
