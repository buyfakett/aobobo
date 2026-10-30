<template>
  <div :class="['location-popup', { mobile }]" @click.stop>
    <div class="popup-header">
      <div class="title-group">
        <h3>{{ location.label }}</h3>
        <div class="popup-stats">
          <span class="stat-chip total">{{ location.totalCount }}台</span>
          <span v-if="localTime" class="stat-chip stat-chip--time">当地 {{ localTime }}</span>
        </div>
      </div>
      <button type="button" class="close-btn" aria-label="关闭位置弹窗" @click="$emit('close')">
        <i class="ri-close-line" />
      </button>
    </div>

    <div class="server-list">
      <server-card
        v-for="server in location.servers"
        :key="server.ID"
        compact
        :server="server"
        :cycle-transfer-map="cycleTransferMap"
        @select="openServer"
      />
    </div>
  </div>
</template>

<script setup>
import ServerCard from '@/components/server-panel/server-card.vue';

const emit = defineEmits(['close', 'select-server']);

defineProps({
  location: {
    type: Object,
    required: true,
  },
  localTime: {
    type: String,
    default: '',
  },
  mobile: {
    type: Boolean,
    default: false,
  },
  placement: {
    type: String,
    default: 'top',
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
  },
});

function openServer(server) {
  emit('select-server', server);
}
</script>

<style lang="scss" scoped>
.location-popup {
  position: relative;
  width: min(380px, calc(100vw - 32px));
  max-height: min(440px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 24px;
  background: var(--globe-popup-bg);
  border: 1px solid var(--globe-popup-border);
  box-shadow: var(--globe-popup-shadow);
  backdrop-filter: blur(20px) saturate(150%);
  color: var(--text-primary);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 72%),
      radial-gradient(ellipse at 0% 0%, rgba(var(--accent-cyan-rgb), 0.12), transparent 60%);
    pointer-events: none;
  }

  &.mobile {
    width: 100%;
    max-height: min(60vh, 480px);
    max-height: min(60dvh, 480px);
    border-radius: 24px 24px 0 0;
    padding: 18px 16px 16px;
    gap: 12px;
  }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.title-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;

  h3 {
    flex: 0 0 auto;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
}

.popup-stats {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.location-popup.mobile {
  .popup-header {
    align-items: flex-start;
    gap: 10px;
  }

  .title-group {
    flex: 1 1 auto;
    min-width: 0;
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;

    h3 {
      flex: 0 0 auto;
      min-width: 0;
      font-size: 16px;
      line-height: 1.3;
      white-space: normal;
      word-break: break-word;
    }
  }

  .popup-stats {
    gap: 5px;
  }

  .stat-chip {
    min-height: 20px;
    padding: 0 7px;
    font-size: 10px;
  }

  .close-btn {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    margin-top: -2px;

    i {
      font-size: 16px;
    }
  }

  .server-list {
    gap: 5px;
  }

  :deep(.server-list-item) {
    padding: 9px 11px;
    border-radius: 12px;
  }

  :deep(.server-list-item__name) {
    font-size: 13px;
  }

  :deep(.server-list-item__head-spec) {
    font-size: 10px;
  }

  :deep(.meta-tag) {
    min-height: 19px;
    padding: 0 6px;
    font-size: 10px;
    border-radius: 5px;
  }

  :deep(.server-list-item__tags) {
    gap: 4px;
  }
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--globe-popup-chip-border);
  background: var(--globe-popup-chip-bg);
  font-size: 11px;
  color: var(--globe-popup-muted);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  &.total {
    color: var(--text-primary);
  }

  &.online {
    color: var(--badge-online-text);
  }

  &.offline {
    color: var(--badge-offline-text);
  }

  &.stat-chip--time {
    color: var(--accent-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}

.close-btn {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--button-subtle-border);
  border-radius: 14px;
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
  }

  i {
    font-size: 18px;
  }
}

.server-list {
  display: grid;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  position: relative;
  z-index: 1;
}

@media screen and (max-width: 768px) {
  .location-popup {
    width: 100%;
    max-height: min(60vh, 500px);
    max-height: min(60dvh, 500px);
  }

  .popup-header {
    align-items: flex-start;
    gap: 10px;
  }

  .title-group {
    flex: 1 1 auto;
    min-width: 0;
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;

    h3 {
      flex: 0 0 auto;
      min-width: 0;
      font-size: 16px;
      line-height: 1.3;
      white-space: normal;
      word-break: break-word;
    }
  }

  .popup-stats {
    gap: 5px;
  }

  .stat-chip {
    min-height: 20px;
    padding: 0 7px;
    font-size: 10px;
  }

  .close-btn {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    margin-top: -2px;

    i {
      font-size: 16px;
    }
  }

  .server-list {
    gap: 5px;
  }

  :deep(.server-list-item) {
    padding: 9px 11px;
    border-radius: 12px;
  }

  :deep(.server-list-item__name) {
    font-size: 13px;
  }

  :deep(.server-list-item__head-spec) {
    font-size: 10px;
  }

  :deep(.meta-tag) {
    min-height: 19px;
    padding: 0 6px;
    font-size: 10px;
    border-radius: 5px;
  }

  :deep(.server-list-item__tags) {
    gap: 4px;
  }
}
</style>
