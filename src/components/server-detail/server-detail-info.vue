<template>
  <detail-panel
    v-if="temperatureData.list.length || showBuyBtn"
    variant="flat"
    class="server-detail-info"
  >
    <div class="info-grid">
      <div
        v-if="temperatureData.list.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-temp-hot-line" />
          <span>温度</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span
              v-for="(ttItem, ttIndex) in temperatureData.list"
              :key="`${info.ID}_temperature_${ttIndex}`"
              class="info-chip"
              :class="`temperature--${ttItem.type}`"
              :title="ttItem?.title || (`${ttItem.label}: ${ttItem.value}`)"
            >
              <span class="info-chip-label">
                <i
                  v-if="ttItem.type === 'cpu' || ttItem.label.toLowerCase().includes('cpu')"
                  class="ri-cpu-line"
                />
                <i
                  v-else-if="ttItem.type === 'gpu' || ttItem.label.toLowerCase().includes('gpu')"
                  class="ri-gamepad-line"
                />
                <i
                  v-else-if="ttItem.type === 'nvme' || ttItem.label.toLowerCase().includes('nvme')"
                  class="ri-hard-drive-3-line"
                />
                <i
                  v-else-if="ttItem.type === 'motherboard'"
                  class="ri-instance-line"
                />
                <i
                  v-else
                  class="ri-temp-hot-line"
                />
                {{ ttItem.label }}
              </span>
              <span class="info-chip-value">{{ ttItem.value }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="showBuyBtn"
        class="info-cell info-cell--full info-cell--action"
      >
        <div
          class="buy-btn"
          @click.stop="toBuy"
        >
          <span :class="buyBtnIcon" />
          <span>{{ buyBtnText }}</span>
        </div>
      </div>
    </div>
  </detail-panel>
</template>

<script setup>
/**
 * 服务器信息盒子
 */
import {
  computed,
} from 'vue';
import config from '@/config';
import DetailPanel from '@/components/server-detail/detail-panel.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const buyBtnIcon = computed(() => {
  if (props.info?.PublicNote?.customData?.buyBtnIcon) {
    return props.info?.PublicNote?.customData?.buyBtnIcon;
  }
  return config.aobobo.buyBtnIcon || 'ri-shopping-bag-3-line';
});
const buyBtnText = computed(() => {
  if (props.info?.PublicNote?.customData?.buyBtnText) {
    return props.info?.PublicNote?.customData?.buyBtnText;
  }
  return config.aobobo.buyBtnText || '购买';
});
const showBuyBtn = computed(() => !!props.info?.PublicNote?.customData?.orderLink);

function toBuy() {
  const decodeUrl = decodeURIComponent(props.info?.PublicNote?.customData?.orderLink);
  window.open(decodeUrl, '_blank');
}

const temperatureData = computed(() => {
  const data = [];
  if (props.info?.State?.Temperatures) {
    const acpitz = [];
    const coretempPackageId = [];
    const coretempCore = [];
    const nvme = [];
    const k10temp = [];
    const amdgpu = [];
    const other = [];

    props.info.State.Temperatures.forEach((item) => {
      const name = item.Name.toLowerCase();
      const temp = item.Temperature;

      if (name.startsWith('acpitz')) {
        acpitz.push(temp);
        return;
      }
      if (name.startsWith('coretemp_package_id_')) {
        const coreIndex = parseInt(name.replace('coretemp_package_id_', ''), 10);
        coretempPackageId.push({
          index: coreIndex,
          value: temp,
        });
        return;
      }
      if (name.startsWith('coretemp_core_')) {
        const coreIndex = parseInt(name.replace('coretemp_core_', ''), 10);
        coretempCore.push({
          index: coreIndex,
          value: temp,
        });
        return;
      }
      if (name.includes('nvme')) {
        nvme.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('k10temp')) {
        k10temp.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('amdgpu')) {
        amdgpu.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('motherboard') || name.includes('mainboard') || name.includes('board')) {
        other.push({
          label: '主板',
          value: temp,
          type: 'motherboard',
        });
        return;
      }
      other.push({
        label: item.Name,
        value: temp,
        type: 'other',
      });
    });

    if (acpitz.length) {
      const acpitzMean = (acpitz.reduce((a, b) => a + b, 0) / acpitz.length).toFixed(1);
      data.push({
        label: '主板',
        value: `${acpitzMean}℃`,
        title: acpitz.map((i, index) => `传感器${index + 1}: ${parseFloat(i).toFixed(1)}℃`).join('\n'),
        type: 'motherboard',
      });
    }

    if (coretempPackageId.length || coretempCore.length) {
      const temps = [];
      const details = [];

      if (coretempPackageId.length) {
        const cpuTemps = coretempPackageId.map((i) => `${parseFloat(i.value).toFixed(1)}℃`);
        temps.push(cpuTemps.join(', '));
        details.push(
          ...coretempPackageId.map(
            (i) => `CPU.${i.index + 1}: ${parseFloat(i.value).toFixed(1)}℃`,
          ),
        );
      }

      if (coretempCore.length) {
        const coreSum = coretempCore.reduce((a, b) => a + b.value, 0);
        const coreMean = (coreSum / coretempCore.length).toFixed(1);
        temps.push(`${parseFloat(coreMean).toFixed(1)}℃`);
        details.push(
          ...coretempCore.map(
            (i) => `核心${i.index + 1}: ${parseFloat(i.value).toFixed(1)}℃`,
          ),
        );
      }

      data.push({
        label: 'CPU',
        value: temps.join(' / '),
        title: details.join('\n'),
        type: 'cpu',
      });
    }

    if (k10temp.length) {
      const tctl = k10temp.find((i) => i.name.includes('tctl'));
      if (tctl) {
        data.push({
          label: 'AMD CPU',
          value: `${parseFloat(tctl.value).toFixed(1)}℃`,
          title: k10temp.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'cpu',
        });
      }
    }

    if (amdgpu.length) {
      const edge = amdgpu.find((i) => i.name.includes('edge'));
      if (edge) {
        data.push({
          label: 'AMD GPU',
          value: `${parseFloat(edge.value).toFixed(1)}℃`,
          title: amdgpu.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'gpu',
        });
      }
    }

    if (nvme.length) {
      const composite = nvme.find((i) => i.name.includes('composite'));
      if (composite) {
        data.push({
          label: 'NVME',
          value: `${parseFloat(composite.value).toFixed(1)}℃`,
          title: nvme.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'nvme',
        });
      }
    }

    other.forEach((i) => {
      data.push({
        label: i.label,
        value: `${parseFloat(i.value).toFixed(1)}℃`,
        type: i.type || 'other',
      });
    });
  }
  return {
    list: data,
  };
});

</script>

<style lang="scss" scoped>
.server-detail-info {
  padding: 14px 18px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.info-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: var(--radius-md);
  background: var(--panel-metric-bg);
  border: 1px solid var(--panel-stat-border);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);

  @media (hover: hover) {
    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }
  }

  &--full {
    grid-column: 1 / -1;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  &--action {
    background: transparent;
    border-color: transparent;
    padding: 4px 0 0;

    &:hover {
      background: transparent;
      border-color: transparent;
      transform: none;
    }
  }
}

.info-cell-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 11px;
  line-height: 1;

  i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    line-height: 1;
    color: var(--accent-primary);
  }
}

.info-cell-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;

  .info-cell--full & {
    justify-content: flex-start;
  }
}

.info-chip-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;

  .info-cell--full & {
    justify-content: flex-start;
  }
}

.info-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  border-radius: 5px;
  background: var(--panel-chip-bg);
  border: 1px solid var(--panel-chip-border);
  font-size: 11px;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);

  @media (hover: hover) {
    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }
  }
}

.info-chip-label {
  color: var(--text-secondary);
}

.info-chip-value {
  color: var(--accent-primary);
}

.buy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  gap: 5px;
  line-height: 1;
  font-weight: 700;
  font-size: 13px;
  color: var(--accent-warning);
  border: 1.5px solid var(--accent-warning);
  border-radius: var(--radius-md);
  transition: all 150ms ease;
  cursor: pointer;

  &:hover {
    color: var(--text-on-accent);
    background-color: var(--accent-warning);
  }

  & > [class^="ri-"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
  }

  span {
    line-height: 1;
  }
}

@media screen and (max-width: 768px) {
  .server-detail-info {
    padding: 10px 12px;
  }

  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .info-cell {
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 6px 8px;

    &--full {
      grid-column: 1 / -1;
    }

    &--action {
      padding: 4px 0 0;
      background: transparent;
      border-color: transparent;
    }
  }

  .info-cell-label {
    gap: 3px;
    font-size: 10px;
    line-height: 1;

    i {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      line-height: 1;
    }
  }

  .info-cell-content {
    justify-content: flex-start;
    font-size: 11px;
  }

  .info-chip-group {
    justify-content: flex-start;
    gap: 3px;
  }

  .info-chip {
    height: 18px;
    padding: 0 4px;
    font-size: 10px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

}

@media screen and (max-width: 900px) and (min-width: 769px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
