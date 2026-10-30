<template>
  <div class="server-detail-header">
    <div class="server-identity">
      <div class="server-flag-box">
        <server-flag :info="info" />
      </div>
      <div class="server-name-and-meta">
        <div class="server-name-row">
          <h2 class="server-name">{{ info.Name }}</h2>
          <span class="server-status-badge">
            <span :class="['status-dot', info.online === 1 ? 'online' : 'offline']" />
            <span>{{ info.online === 1 ? '在线' : '离线' }}</span>
          </span>
          <span
            v-if="availabilityText && store.state.showAvailability"
            :class="['server-status-badge', 'server-status-badge--availability', availabilityClass]"
          >
            <i class="ri-shield-check-line" />
            <span>可用 {{ availabilityText }}%</span>
          </span>
        </div>

        <div
          v-if="slogan"
          class="slogan-content"
        >
          <span>“{{ slogan }}”</span>
        </div>
        <div
          v-else-if="cpuInfo?.model"
          class="cpu-model-info"
        >
          <span
            v-if="cpuInfo.company"
            class="cpu-company"
            :class="'cpu-company--' + cpuInfo.company.toLowerCase()"
          >
            {{ cpuInfo.company }}
          </span>
          <span
            v-if="cpuInfo.model"
            class="cpu-model"
          >
            {{ cpuInfo.model }}
          </span>
          <span
            v-if="cpuInfo.modelNum"
            class="cpu-model-num"
          >
            {{ cpuInfo.modelNum }}
          </span>
        </div>

        <div
          v-if="hasMetaTags"
          class="meta-tag-row"
        >
          <span
            v-if="regionLabel"
            class="meta-tag meta-tag--region"
          >
            <i class="ri-map-pin-line" />
            {{ regionLabel }}
          </span>
          <span
            v-if="systemOSLabel"
            class="meta-tag meta-tag--os"
          >
            <i :class="systemOSIcon" />
            {{ systemOSLabel }}
          </span>
          <span
            v-if="cpuLabel"
            class="meta-tag meta-tag--cpu"
            :title="cpuLabel"
          >
            <i class="ri-cpu-line" />
            {{ cpuLabel }}
          </span>
          <span
            v-if="gpuLabel"
            class="meta-tag meta-tag--gpu"
            :title="gpuLabel"
          >
            <i class="ri-gamepad-line" />
            {{ gpuLabel }}
          </span>
          <span
            v-if="memoryDiskLabel"
            class="meta-tag meta-tag--storage"
          >
            <i class="ri-ram-line" />
            {{ memoryDiskLabel }}
          </span>
          <span
            v-if="systemVersionLabel"
            class="meta-tag meta-tag--version"
          >
            <i class="ri-information-line" />
            {{ systemVersionLabel }}
          </span>
          <span
            v-if="billingLabel"
            class="meta-tag meta-tag--billing"
          >
            <i class="ri-wallet-3-line" />
            {{ billingLabel }}
          </span>
          <span
            v-if="remainingTimeLabel"
            class="meta-tag meta-tag--remaining"
          >
            <i class="ri-calendar-check-line" />
            {{ remainingTimeLabel }}
          </span>
          <span
            v-if="bandwidthLabel"
            class="meta-tag meta-tag--bandwidth"
          >
            <i class="ri-speed-up-line" />
            {{ bandwidthLabel }}
          </span>
          <span
            v-if="planTrafficLabel"
            class="meta-tag meta-tag--traffic"
          >
            <i class="ri-bar-chart-box-line" />
            {{ planTrafficLabel }}
          </span>
          <span
            v-if="loadLabel"
            class="meta-tag meta-tag--load"
          >
            <i class="ri-pulse-line" />
            负载 {{ loadLabel }}
          </span>
          <span
            v-if="transferLabel"
            class="meta-tag meta-tag--transfer"
          >
            <i class="ri-arrow-up-down-line" />
            {{ transferLabel }}
          </span>
          <span
            v-if="bootTimeLabel"
            class="meta-tag meta-tag--boot"
            :title="`启动时间：${bootTimeLabel}`"
          >
            <i class="ri-restart-line" />
            {{ bootTimeLabel }}
          </span>
          <span
            v-if="lastActiveLabel"
            class="meta-tag meta-tag--active"
            :title="`最后活跃：${lastActiveLabel}`"
          >
            <i class="ri-time-line" />
            {{ lastActiveLabel }}
          </span>
          <span
            v-for="tag in tagList"
            :key="tag"
            class="meta-tag meta-tag--tag"
          >
            <i class="ri-price-tag-3-line" />
            {{ tag }}
          </span>
        </div>
      </div>
    </div>

    <button
      v-if="showDetailGlobe"
      type="button"
      class="globe-focus-btn globe-focus-btn--visual"
      :aria-label="`在地球上查看 ${info?.Name || '服务器'}`"
      @click="viewOnGlobe"
    >
      <server-detail-globe :location="detailGlobeLocation" />
    </button>

    <button
      v-else-if="showFallbackFocusButton"
      type="button"
      class="globe-focus-btn globe-focus-btn--text"
      @click="viewOnGlobe"
    >
      <i class="ri-earth-line" />
      <span>在地球上查看</span>
    </button>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  h,
} from 'vue';
import dayjs from 'dayjs';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import * as hostUtils from '@/utils/host';
import { resolveServerLocation } from '@/utils/world-map';
import truncateDecimal from '@/utils/number';
import useServerInfo from '@/composables/server-info';
import useServerBillAndPlan from '@/composables/server-bill-and-plan';
import ServerFlag from '@/components/server-flag.vue';
import config from '@/config';

const ServerDetailGlobePlaceholder = {
  render: () => h('div', { class: 'server-detail-globe-placeholder' }),
};

const ServerDetailGlobe = defineAsyncComponent({
  loader: () => import('@/components/server-detail/server-detail-globe.vue'),
  loadingComponent: ServerDetailGlobePlaceholder,
  delay: 0,
});

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();
const store = useStore();

const { cpuAndMemAndDisk } = useServerInfo({ props });
const { billAndPlan } = useServerBillAndPlan({ props });

const slogan = computed(() => props.info?.PublicNote?.customData?.slogan);
const cpuInfo = computed(() => hostUtils.getCPUInfo(props.info?.Host?.CPU?.[0]));
const cpuLabel = computed(() => {
  const source = props.info?.Host?.CPU?.[0] || '';
  if (source) {
    return source;
  }
  return [cpuInfo.value?.company, cpuInfo.value?.model, cpuInfo.value?.modelNum]
    .filter(Boolean)
    .join(' ');
});
const gpuLabel = computed(() => (props.info?.Host?.GPU || [])
  .filter((item) => String(item).trim())
  .join(' / '));
const memoryDiskLabel = computed(() => {
  const spec = String(cpuAndMemAndDisk.value || '').trim();
  const match = spec.match(/^\d+C(?:\d+(?:\.\d+)?[GTM])+(.*)$/i);
  return match ? match[1].replace(/^[\s,/]+/, '') : '';
});
const systemVersionLabel = computed(() => props.info?.Host?.PlatformVersion || '');
const loadLabel = computed(() => {
  const state = props.info?.State;
  const values = [state?.Load1, state?.Load5, state?.Load15].filter((item) => item !== undefined);
  return values.length ? values.map((item) => Number(item).toFixed(2)).join(' / ') : '';
});
const transferLabel = computed(() => {
  const inValue = Number(props.info?.State?.NetInTransfer) || 0;
  const outValue = Number(props.info?.State?.NetOutTransfer) || 0;
  if (!inValue && !outValue) {
    return '';
  }
  const inTransfer = hostUtils.calcTransfer(inValue);
  const outTransfer = hostUtils.calcTransfer(outValue);
  return `入 ${inTransfer.value}${inTransfer.unit} · 出 ${outTransfer.value}${outTransfer.unit}`;
});
const bootTimeLabel = computed(() => (
  props.info?.Host?.BootTime
    ? dayjs(props.info.Host.BootTime * 1000).format('MM-DD HH:mm')
    : ''
));
const lastActiveLabel = computed(() => (
  props.info?.LastActive
    ? dayjs(props.info.LastActive).format('MM-DD HH:mm')
    : ''
));
const tagList = computed(() => {
  const values = [];
  const { networkRoute, extra, IPv4, IPv6 } = props.info?.PublicNote?.planDataMod || {};
  if (networkRoute) {
    values.push(...String(networkRoute).split(','));
  }
  if (extra) {
    values.push(...String(extra).split(','));
  }
  if (IPv4 === '1' && IPv6 === '1') {
    values.push('双栈IP');
  } else if (IPv4 === '1') {
    values.push('仅IPv4');
  } else if (IPv6 === '1') {
    values.push('仅IPv6');
  }
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
});
function billLabel(item, separator = ' ') {
  if (!item?.value) {
    return '';
  }
  return item.label ? `${item.label}${separator}${item.value}` : String(item.value);
}
const billingLabel = computed(() => billLabel(billAndPlan.value?.billing));
const remainingTimeLabel = computed(() => billLabel(billAndPlan.value?.remainingTime));
const bandwidthLabel = computed(() => billLabel(billAndPlan.value?.bandwidth));
const planTrafficLabel = computed(() => billLabel(billAndPlan.value?.traffic));
const systemOSLabel = computed(() => {
  if (props.info?.Host?.Platform) {
    return hostUtils.getSystemOSLabel(props.info.Host.Platform);
  }
  return '';
});

const systemOSIcon = computed(() => {
  if (props.info?.Host?.Platform) {
    return hostUtils.getPlatformLogoIconClassName(props.info.Host.Platform);
  }
  return 'ri-server-line';
});

const resolvedLocation = computed(() => resolveServerLocation(props.info));

const availabilityValue = computed(() => {
  const value = props.info?.availability;
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(value);
});

const availabilityText = computed(() => {
  if (availabilityValue.value === null) return '';
  return truncateDecimal(availabilityValue.value, 2);
});

const availabilityClass = computed(() => {
  if (availabilityValue.value === null) return '';
  if (availabilityValue.value >= 99) return 'availability-status--success';
  if (availabilityValue.value >= 95) return 'availability-status--warning';
  return 'availability-status--danger';
});

function normalizeCountryCode(code) {
  if (typeof code !== 'string') {
    return '';
  }
  const normalized = code.trim().toUpperCase();
  if (normalized === 'UK') {
    return 'GB';
  }
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}

const locationCode = computed(() => resolvedLocation.value?.code || '');
const countryCode = computed(() => normalizeCountryCode(props.info?.Host?.CountryCode)
  || normalizeCountryCode(resolvedLocation.value?.aliasCode));

const detailGlobeLocation = computed(() => {
  const loc = resolvedLocation.value;
  if (!loc) {
    return {};
  }

  return {
    ...loc,
    countryCode: countryCode.value,
  };
});

const hideDetailGlobe = computed(() => config.aobobo?.hideDetailServerGlobe === true);
const showDetailGlobe = computed(() => !!locationCode.value && !hideDetailGlobe.value);
const showFallbackFocusButton = computed(() => !!locationCode.value && hideDetailGlobe.value);

const regionLabel = computed(() => {
  const loc = resolvedLocation.value;
  if (!loc) {
    return '';
  }
  if (loc.source === 'manual') {
    return loc.name || '自定义位置';
  }
  return loc.name || loc.code;
});

const hasMetaTags = computed(() => Boolean(
  regionLabel.value
  || systemOSLabel.value
  || cpuLabel.value
  || gpuLabel.value
  || memoryDiskLabel.value
  || systemVersionLabel.value
  || billingLabel.value
  || remainingTimeLabel.value
  || bandwidthLabel.value
  || planTrafficLabel.value
  || loadLabel.value
  || transferLabel.value
  || bootTimeLabel.value
  || lastActiveLabel.value
  || tagList.value.length,
));

function viewOnGlobe() {
  if (!locationCode.value) {
    return;
  }
  store.dispatch('focusGlobeOnServer', {
    code: locationCode.value,
    name: props.info?.Name || '',
  });
  router.push({
    name: 'Home',
  });
}
</script>

<style lang="scss" scoped>
.server-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  transition: 0.3s;

  .server-identity {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .server-flag-box {
    --flag-size: 48px;
    position: relative;
    flex: 0 0 auto;
    width: calc(var(--flag-size) * 1.33333333);
    height: var(--flag-size);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);

    .server-flag {
      position: absolute;
      top: 50%;
      left: 50%;
      width: calc(var(--flag-size) * 1.33333333);
      height: var(--flag-size);
      line-height: var(--flag-size);
      font-size: var(--flag-size);
      transform: translate(-50%, -50%);
    }
  }

  .server-name-and-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .server-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .server-name {
    min-width: 0;
    line-height: 1.2;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .server-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--panel-chip-text);
    white-space: nowrap;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;

      &.online {
        background: var(--accent-success);
        box-shadow: var(--status-online-glow);
      }

      &.offline {
        background: var(--accent-danger);
        box-shadow: var(--status-offline-glow);
      }
    }

    &--availability {
      gap: 3px;

      &.availability-status--success {
        color: var(--accent-success);
        border-color: rgba(var(--accent-success-rgb), 0.3);
        background: rgba(var(--accent-success-rgb), 0.1);
      }

      &.availability-status--warning {
        color: var(--accent-warning);
        border-color: rgba(229, 160, 38, 0.35);
        background: rgba(229, 160, 38, 0.12);
      }

      &.availability-status--danger {
        color: var(--accent-danger);
        border-color: rgba(var(--accent-danger-rgb), 0.35);
        background: rgba(var(--accent-danger-rgb), 0.12);
      }

      i {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
      }
    }
  }

  .globe-focus-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    &:hover,
    &:focus-visible {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid rgba(var(--accent-primary-rgb), 0.42);
      outline-offset: 3px;
    }
  }

  .globe-focus-btn--visual {
    --detail-globe-size: 144px;
    position: relative;
    width: var(--detail-globe-size);
    height: var(--detail-globe-size);
    padding: 0;
    border-color: transparent;
    border-radius: 0;
    overflow: visible;
    background: transparent;
    box-shadow: none;

    &:hover,
    &:focus-visible {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      transform: none;
    }
  }

  .server-detail-globe-placeholder {
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .globe-focus-btn--text {
    gap: 5px;
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;

    i {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }

    span {
      line-height: 1;
    }
  }

  .slogan-content {
    color: var(--text-secondary);
    line-height: 1.35;
    font-size: 12px;
  }

  .cpu-model-info {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    line-height: 1.35;
    color: var(--text-secondary);
    font-size: 12px;

    .cpu-company {
      height: 20px;
      line-height: 20px;
      padding: 0 5px;
      border-radius: 4px;
      color: #111;
      background: #e0fcff;
      font-size: 10px;
      font-weight: 700;

      &--intel {
        text-transform: lowercase;
        color: #fff;
        background: #0068b5;
      }

      &--amd {
        font-weight: bold;
      }

      &--apple {
        font-weight: 600;
        border-radius: 4px;
      }
    }

    .cpu-model {
      color: var(--text-primary);
      font-weight: 500;
    }

    .cpu-model-num {
      color: var(--text-muted);
    }
  }

  .meta-tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 22px;
    height: auto;
    padding: 0 7px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text-secondary);
    background: var(--panel-stat-bg);
    border: 1px solid var(--panel-stat-border);
    max-width: 100%;
    overflow-wrap: anywhere;

    i {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
      line-height: 1;
      color: var(--accent-primary);
    }

    &--cpu {
      flex: 0 1 auto;
    }

    &--gpu {
      flex-basis: 100%;
    }

    &--cpu,
    &--gpu,
    &--storage,
    &--version {
      color: var(--text-primary);
    }
  }
}

@media screen and (max-width: 768px) {
  .server-detail-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 8px;
    padding: 8px 12px;

    .server-identity {
      gap: 10px;
      min-width: 0;
    }

    .server-flag-box {
      --flag-size: 38px;
      border-radius: 8px;
    }

    .server-name-and-meta {
      gap: 3px;
    }

    .server-name {
      font-size: 15px;
    }

    .globe-focus-btn--visual {
      --detail-globe-size: 112px;
    }

    .globe-focus-btn--text {
      grid-column: 1 / -1;
      width: 100%;
      justify-content: center;
      height: 28px;
      font-size: 12px;
    }
  }
}

@media screen and (max-width: 480px) {
  .server-detail-header {
    gap: 8px;
    padding: 8px 10px;

    .server-identity {
      gap: 8px;
    }

    .server-flag-box {
      --flag-size: 34px;
    }

    .server-name-row {
      gap: 6px;
    }

    .server-name {
      font-size: 14px;
    }

    .server-status-badge {
      height: 20px;
      padding: 0 6px;
      font-size: 10px;
    }

    .meta-tag {
      min-height: 20px;
      padding: 1px 6px;
      font-size: 10px;
    }

    .globe-focus-btn--visual {
      --detail-globe-size: 88px;
    }
  }
}
</style>
