<template>
  <detail-panel
    variant="flat"
    class="server-online-history"
  >
    <div class="history-head">
      <span class="module-title">
        <i class="ri-history-line" />
        在线历史
      </span>
      <div class="head-controls">
        <span
          v-if="history"
          class="online-state"
          :class="{ 'is-online': history.currently_online }"
        >
          <span class="online-state__dot" />
          {{ history.currently_online ? '在线' : '离线' }}
        </span>
        <div
          class="range-switch"
          role="group"
          aria-label="在线历史时间范围"
        >
          <button
            v-for="option in dayOptions"
            :key="option"
            type="button"
            class="range-option"
            :class="{
              active: selectedDays === option,
              locked: option > maxSelectableDays,
            }"
            :disabled="option > maxSelectableDays"
            :title="option > maxSelectableDays ? '当前账号只能查看最近 1 天' : `最近 ${option} 天`"
            @click="selectDays(option)"
          >
            {{ option }}天
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading && !history" class="history-skeleton" aria-label="正在加载在线历史">
      <div class="skeleton-summary">
        <span v-for="item in 4" :key="item" />
      </div>
      <div class="skeleton-line" />
      <div class="skeleton-line skeleton-line--short" />
    </div>

    <div v-else-if="error" class="history-message">
      <i class="ri-error-warning-line" />
      <span>{{ error }}</span>
      <button type="button" class="text-button" @click="loadHistory">
        重试
      </button>
    </div>

    <template v-else-if="history">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">在线率</span>
          <strong>{{ onlineRateText }}%</strong>
          <span class="rate-track">
            <span class="rate-fill" :style="{ width: onlineRateText + '%' }" />
          </span>
          <span class="summary-foot">{{ windowRange }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">窗口内在线</span>
          <strong>{{ formatDuration(history.total_online_seconds) }}</strong>
          <span class="summary-foot">{{ windowRange }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">窗口内离线</span>
          <strong>{{ formatDuration(offlineSeconds) }}</strong>
          <span class="summary-foot">{{ windowRange }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">最后活跃</span>
          <strong>{{ lastActiveTime }}</strong>
          <span class="summary-foot">{{ lastActiveDate }}</span>
        </div>
      </div>

      <div class="history-block">
        <div class="block-head">
          <span class="block-title">每日在线</span>
          <span class="block-meta">0:00 - 24:00<span v-if="panelTimezone"> · {{ panelTimezone }}</span></span>
        </div>
        <div class="daily-grid">
          <div
            v-for="day in dailyRows"
            :key="day.date"
            class="daily-row"
          >
            <div class="daily-head">
              <span>{{ day.date }}</span>
              <span>{{ formatDuration(day.online_seconds) }}</span>
            </div>
            <div class="timeline">
              <span
                v-if="day.window.leftPct > 0"
                class="timeline-shade timeline-shade--outside"
                :style="{ width: day.window.leftPct + '%' }"
                title="窗口外"
              />
              <span
                v-if="day.window.rightPct < 100"
                class="timeline-shade timeline-shade--future"
                :style="{
                  left: day.window.rightPct + '%',
                  width: (100 - day.window.rightPct) + '%',
                }"
                title="尚未记录"
              />
              <button
                v-for="segment in day.segments"
                :key="segmentKey(segment)"
                type="button"
                class="online-segment"
                :class="{ 'is-live': segment.live }"
                :style="{
                  left: segment.leftPct + '%',
                  width: segment.widthPct + '%',
                }"
                :title="segmentTitle(segment)"
                :aria-label="segmentTitle(segment)"
              />
              <span
                v-for="tick in [25, 50, 75]"
                :key="tick"
                class="timeline-tick"
                :style="{ left: tick + '%' }"
              />
            </div>
            <div class="timeline-scale">
              <span v-for="hour in [0, 6, 12, 18, 24]" :key="hour">{{ hour }}</span>
            </div>
          </div>
        </div>
        <div class="timeline-legend">
          <span><i class="legend-shade" />窗口外</span>
          <span><i class="legend-recorded" />尚未记录</span>
        </div>
      </div>

      <div class="history-block">
        <div class="block-head">
          <span class="block-title">{{ periodMode === 'online' ? '在线时段' : '离线时段' }}</span>
          <div class="mode-switch" role="group" aria-label="时段类型">
            <button
              type="button"
              :class="{ active: periodMode === 'online' }"
              @click="setPeriodMode('online')"
            >
              在线
            </button>
            <button
              type="button"
              :class="{ active: periodMode === 'offline' }"
              @click="setPeriodMode('offline')"
            >
              离线
            </button>
          </div>
        </div>
        <div v-if="visibleGroups.length" class="period-groups">
          <div
            v-for="group in visibleGroups"
            :key="group.date"
            class="period-group"
          >
            <div class="period-group__head">
              <span>
                {{ group.day.format('MM-DD') }}
                <em v-if="isToday(group.date)"> · 今天</em>
              </span>
              <span>
                {{ periodMode === 'online' ? '在线' : '离线' }}
                {{ formatDuration(group.total) }}
              </span>
            </div>
            <div class="period-chips">
              <span
                v-for="(chip, index) in group.chips"
                :key="`${chip.start.valueOf()}-${index}`"
                class="period-chip"
                :class="[
                  `period-chip--${periodMode}`,
                  { 'is-live': chip.ongoing },
                ]"
                :title="chipTitle(chip)"
              >
                <i v-if="chip.ongoing" class="period-chip__dot" />
                <span>{{ chip.start.format('HH:mm') }}</span>
                <span class="period-chip__arrow">→</span>
                <span>{{ chip.ongoing ? '持续中' : formatPeriodMoment(chip.end, chip.start, panelTimezone) }}</span>
                <span class="period-chip__duration">{{ formatDuration(chip.end.diff(chip.start, 'second')) }}</span>
              </span>
            </div>
          </div>
          <button
            v-if="periodGroups.length > visibleDayCount"
            type="button"
            class="expand-button"
            @click="visibleDayCount += expandStep"
          >
            展开更多
          </button>
        </div>
        <p v-else class="history-empty">当前时间范围内没有{{ periodMode === 'online' ? '在线' : '离线' }}记录。</p>
      </div>
    </template>

    <div v-else class="history-message">
      <i class="ri-information-line" />
      <span>当前探针版本暂不提供在线历史接口。</span>
    </div>
  </detail-panel>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import DetailPanel from '@/components/server-detail/detail-panel.vue';
import {
  buildDailyOnlineRows,
  buildOfflineGroups,
  formatDuration,
  formatPeriodMoment,
  groupOnlineRows,
  panelDay,
  panelNow,
  windowDurationSeconds,
} from '@/utils/online-history';
import {
  isOnlineHistorySupported,
  loadServerOnlineHistory,
} from '@/utils/load-online-history';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const dayOptions = [1, 7, 30];
const expandStep = 10;
const initialVisibleDays = 3;
const selectedDays = ref(1);
const maxSelectableDays = ref(30);
const periodMode = ref('online');
const visibleDayCount = ref(initialVisibleDays);
const history = ref(null);
const loading = ref(false);
const error = ref('');
let refreshTimer = null;
let requestSerial = 0;

const panelTimezone = computed(() => history.value?.timezone || '');
const dailyRows = computed(() => {
  const current = history.value;
  if (!current) {
    return [];
  }
  return buildDailyOnlineRows(
    current.periods,
    current.daily,
    current.window_start,
    current.window_end,
    panelTimezone.value,
  );
});
const periodGroups = computed(() => {
  const current = history.value;
  if (!current) {
    return [];
  }
  if (periodMode.value === 'online') {
    return groupOnlineRows(dailyRows.value, panelTimezone.value);
  }
  return buildOfflineGroups(
    current.periods,
    current.daily,
    current.window_start,
    current.window_end,
    current.currently_online,
    panelTimezone.value,
  );
});
const visibleGroups = computed(() => (
  periodGroups.value.slice(0, visibleDayCount.value)
));
const onlineRateText = computed(() => {
  const rate = Number(history.value?.online_rate);
  return Number.isFinite(rate) ? rate.toFixed(1) : '0.0';
});
const offlineSeconds = computed(() => Math.max(
  0,
  windowDurationSeconds(
    history.value?.window_start,
    history.value?.window_end,
    panelTimezone.value,
  ) - (Number(history.value?.total_online_seconds) || 0),
));
const windowRange = computed(() => {
  const current = history.value;
  if (!current) {
    return '';
  }
  const start = panelDay(current.window_start, panelTimezone.value).format('MM-DD');
  const end = panelDay(current.window_end, panelTimezone.value).format('MM-DD');
  return `${start} - ${end}`;
});
const lastActiveDate = computed(() => {
  if (!history.value?.last_active) {
    return '暂无记录';
  }
  return panelDay(history.value.last_active, panelTimezone.value).format('YYYY-MM-DD');
});
const lastActiveTime = computed(() => {
  if (!history.value?.last_active) {
    return 'N/A';
  }
  return panelDay(history.value.last_active, panelTimezone.value).format('HH:mm:ss');
});

function selectDays(days) {
  if (days > maxSelectableDays.value || selectedDays.value === days) {
    return;
  }
  selectedDays.value = days;
  visibleDayCount.value = initialVisibleDays;
  loadHistory();
}

function setPeriodMode(mode) {
  if (periodMode.value === mode) {
    return;
  }
  periodMode.value = mode;
  visibleDayCount.value = initialVisibleDays;
}

function isToday(date) {
  return panelNow(panelTimezone.value).isSame(panelDay(date, panelTimezone.value), 'day');
}

function segmentKey(segment) {
  return `${segment.period.start}-${segment.leftPct}`;
}

function segmentTitle(segment) {
  const end = segment.live
    ? '持续中'
    : formatPeriodMoment(segment.segEnd, segment.segStart, panelTimezone.value, true);
  return `${segment.segStart.format('HH:mm:ss')} → ${end}`;
}

function chipTitle(chip) {
  const end = chip.ongoing
    ? '持续中'
    : formatPeriodMoment(chip.end, chip.start, panelTimezone.value, true);
  return `${chip.start.format('HH:mm:ss')} → ${end}`;
}

function isGuestLimitError(err) {
  return String(err?.response?.data?.error || err?.response?.data?.message || err?.message || '')
    .toLowerCase()
    .includes('only 1d data available for guests');
}

function errorMessage(err) {
  if (isGuestLimitError(err)) {
    return '游客仅可查看最近 1 天在线历史。';
  }
  if (err?.response?.status === 404) {
    return '当前探针版本暂不提供在线历史接口。';
  }
  if (err?.response?.status === 401 || err?.response?.status === 403) {
    return '登录后可查看更多在线历史。';
  }
  return '在线历史加载失败，请稍后重试。';
}

async function loadHistory() {
  if (!isOnlineHistorySupported() || !props.info?.ID) {
    history.value = null;
    return;
  }
  const serial = requestSerial + 1;
  requestSerial = serial;
  loading.value = true;
  error.value = '';
  try {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    const data = await loadServerOnlineHistory(props.info.ID, selectedDays.value);
    if (serial !== requestSerial) {
      return;
    }
    history.value = data;
    const maxDays = Number(data.max_days);
    if (Number.isFinite(maxDays) && maxDays > 0) {
      maxSelectableDays.value = Math.min(maxDays, dayOptions[dayOptions.length - 1]);
    }
  } catch (err) {
    if (serial !== requestSerial) {
      return;
    }
    if (isGuestLimitError(err) && selectedDays.value !== 1) {
      maxSelectableDays.value = 1;
      selectedDays.value = 1;
      loading.value = false;
      await loadHistory();
      return;
    }
    error.value = errorMessage(err);
  } finally {
    if (serial === requestSerial) {
      loading.value = false;
      scheduleRefresh();
    }
  }
}

function scheduleRefresh() {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    loadHistory();
  }, 60000);
}

watch(
  () => props.info?.ID,
  () => {
    history.value = null;
    maxSelectableDays.value = dayOptions[dayOptions.length - 1];
    selectedDays.value = 1;
    periodMode.value = 'online';
    visibleDayCount.value = initialVisibleDays;
    loadHistory();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  requestSerial += 1;
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }
});
</script>

<style lang="scss" scoped>
.server-online-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
}

.history-head,
.block-head,
.period-group__head,
.daily-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.history-head {
  flex-wrap: wrap;
}

.module-title,
.block-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-weight: 700;
}

.module-title {
  min-height: 28px;
  font-size: 15px;

  i {
    color: var(--accent-primary);
    font-size: 18px;
  }
}

.block-title {
  font-size: 14px;
}

.head-controls,
.online-state,
.range-switch,
.mode-switch,
.period-chips,
.timeline-legend {
  display: flex;
  align-items: center;
}

.head-controls {
  flex-wrap: wrap;
  gap: 8px;
}

.online-state {
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.online-state__dot,
.period-chip__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.online-state.is-online {
  color: var(--accent-success);

  .online-state__dot {
    background: var(--accent-success);
    box-shadow: var(--status-online-glow);
  }
}

.range-switch,
.mode-switch {
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--panel-chip-border);
  border-radius: 999px;
  background: var(--panel-chip-bg);
}

.range-option,
.mode-switch button {
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover:not(:disabled, .active) {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
}

.range-option {
  min-width: 42px;
  height: 26px;
  padding: 0 9px;

  &.active,
  .mode-switch button.active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
  }

  &.locked {
    opacity: 0.38;
    cursor: not-allowed;
  }
}

.mode-switch button {
  min-width: 40px;
  height: 24px;
  padding: 0 8px;

  &.active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--panel-stat-border);
  border-bottom: 1px solid var(--panel-stat-border);
}

.summary-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  text-align: center;

  & + & {
    border-left: 1px solid var(--panel-stat-border);
  }

  strong {
    max-width: 100%;
    overflow: hidden;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 17px;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.summary-label,
.summary-foot,
.block-meta {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.3;
}

.rate-track {
  width: 72px;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--progress-track);
}

.rate-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent-success);
}

.history-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--panel-stat-border);
}

.block-meta {
  font-family: var(--font-mono);
}

.daily-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.daily-row {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--panel-stat-border);
  border-radius: 8px;
  background: var(--panel-metric-bg);

  &:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

.daily-head {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;

  span:last-child {
    color: var(--text-muted);
  }
}

.timeline {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--progress-track);
}

.timeline-shade,
.online-segment,
.timeline-tick {
  position: absolute;
  inset-block: 0;
}

.timeline-shade {
  z-index: 1;
  pointer-events: none;
}

.timeline-shade--outside {
  left: 0;
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 3px,
    var(--text-muted) 3px,
    var(--text-muted) 4px
  );
  opacity: 0.28;
}

.timeline-shade--future {
  background: var(--bg-primary);
  opacity: 0.7;
}

.online-segment {
  z-index: 2;
  min-width: 2px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--accent-success);
  cursor: help;
  opacity: 0.9;
  transition: opacity var(--transition-fast);

  &:hover,
  &.is-live {
    opacity: 1;
  }
}

.timeline-tick {
  z-index: 3;
  width: 1px;
  background: var(--text-primary);
  opacity: 0.14;
  pointer-events: none;
}

.timeline-scale {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.timeline-legend {
  flex-wrap: wrap;
  gap: 10px;
  color: var(--text-muted);
  font-size: 10px;
}

.timeline-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-shade,
.legend-recorded {
  display: inline-block;
  width: 12px;
  height: 8px;
  border-radius: 2px;
}

.legend-shade {
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 3px,
    var(--text-muted) 3px,
    var(--text-muted) 4px
  );
}

.legend-recorded {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.period-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.period-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.period-group__head {
  color: var(--text-secondary);
  font-size: 11px;

  span:last-child {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  em {
    color: var(--text-muted);
    font-style: normal;
  }
}

.period-chips {
  flex-wrap: wrap;
  gap: 5px;
}

.period-chip {
  display: inline-flex;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--panel-chip-border);
  border-radius: 6px;
  background: var(--panel-chip-bg);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: default;

  &--online {
    border-color: rgba(var(--accent-success-rgb), 0.24);
    background: rgba(var(--accent-success-rgb), 0.09);
    color: var(--accent-success);
  }

  &--offline {
    border-color: rgba(229, 160, 38, 0.28);
    background: rgba(229, 160, 38, 0.09);
    color: var(--accent-warning);
  }
}

.period-chip__dot {
  flex: 0 0 auto;
  background: currentColor;
  box-shadow: 0 0 0 3px rgba(var(--accent-success-rgb), 0.12);
  animation: online-pulse 1.8s ease-in-out infinite;
}

.period-chip__arrow {
  color: var(--text-muted);
}

.period-chip__duration {
  color: var(--text-muted);
}

.expand-button,
.text-button {
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }
}

.expand-button {
  width: 100%;
  min-height: 30px;
}

.text-button {
  min-height: 26px;
  padding: 0 10px;
}

.history-message,
.history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 72px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.history-message i {
  color: var(--accent-warning);
  font-size: 16px;
}

.history-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.skeleton-summary span,
.skeleton-line {
  display: block;
  border-radius: 6px;
  background: var(--panel-chip-bg);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-summary span {
  height: 50px;
}

.skeleton-line {
  height: 54px;
}

.skeleton-line--short {
  height: 30px;
}

@keyframes skeleton-pulse {
  50% {
    opacity: 0.45;
  }
}

@keyframes online-pulse {
  50% {
    opacity: 0.35;
  }
}

@media screen and (max-width: 768px) {
  .server-online-history {
    padding: 12px 14px;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-item:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--panel-stat-border);
  }

  .summary-item:nth-child(4) {
    border-top: 1px solid var(--panel-stat-border);
  }

  .daily-grid {
    grid-template-columns: 1fr;
  }

  .daily-row:last-child:nth-child(odd) {
    grid-column: auto;
  }
}

@media screen and (max-width: 460px) {
  .history-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-controls {
    width: 100%;
    justify-content: space-between;
  }

  .summary-item strong {
    font-size: 14px;
  }

  .period-chip {
    white-space: normal;
  }
}
</style>
