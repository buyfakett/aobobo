<template>
  <transition name="all-hosts-fade">
    <div
      v-if="visible"
      class="all-hosts-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-hosts-modal-title"
      @click.self="handleClose"
    >
      <div class="all-hosts-modal">
        <div class="all-hosts-modal__header">
          <div class="all-hosts-modal__title-group">
            <span class="all-hosts-modal__icon" aria-hidden="true">
              <i class="ri-server-line" />
            </span>
            <h3 id="all-hosts-modal-title">全部主机总览</h3>
          </div>
          <button
            type="button"
            class="all-hosts-modal__close"
            aria-label="关闭全部主机总览"
            @click="handleClose"
          >
            <i class="ri-close-line" />
          </button>
        </div>

        <div class="all-hosts-modal__toolbar">
          <label class="all-hosts-search">
            <i class="ri-search-line" />
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="搜索名称 / 地区 / 系统"
            >
            <button
              v-if="searchKeyword.trim() !== ''"
              type="button"
              class="all-hosts-search__clear"
              title="清空搜索"
              @click="searchKeyword = ''"
            >
              <i class="ri-close-line" />
            </button>
          </label>
          <div class="all-hosts-status-chips" role="group" aria-label="筛选状态">
            <button
              v-for="option in FILTER_OPTIONS"
              :key="option.value || 'all'"
              type="button"
              :class="['status-chip', option.dot, { active: filterOnline === option.value }]"
              @click="filterOnline = option.value"
            >
              <span v-if="option.dot" class="status-chip__dot" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="all-hosts-modal__groups-bar">
          <div class="summary-badges">
            <span class="summary-badge">
              <i class="ri-server-line" />
              <span>共</span>
              <strong>{{ serverCount.total }}</strong>
              <span>台</span>
            </span>
            <span class="summary-badge summary-badge--online">
              <i class="ri-checkbox-blank-circle-fill" />
              <span>在线</span>
              <strong>{{ serverCount.online }}</strong>
            </span>
            <span
              v-if="serverCount.offline > 0"
              class="summary-badge summary-badge--offline"
            >
              <i class="ri-checkbox-blank-circle-fill" />
              <span>离线</span>
              <strong>{{ serverCount.offline }}</strong>
            </span>
          </div>
          <template v-if="displayGroups.length > 1">
            <span class="groups-bar-divider" aria-hidden="true" />
            <button
              v-for="(group, index) in displayGroups"
              :key="group.key"
              type="button"
              class="group-jump-chip"
              :title="group.label"
              @click="scrollToGroup(index)"
            >
              <span class="group-jump-chip__name">{{ group.label }}</span>
              <span class="group-jump-chip__count">{{ group.servers.length }}</span>
            </button>
          </template>
          <div v-if="isFiltered" class="summary-filter-hint">
            <span class="summary-matched">{{ matchedCount }} 条匹配</span>
            <button
              type="button"
              class="summary-clear-btn"
              @click="clearFilters"
            >
              清除筛选
            </button>
          </div>
        </div>

        <div ref="bodyRef" class="all-hosts-modal__body">
          <section
            v-for="(group, index) in displayGroups"
            :key="group.key"
            class="host-group"
            :data-group-index="index"
          >
            <div class="host-group__header">
              <h4 class="host-group__title" :title="group.label">
                {{ group.label }}
              </h4>
              <div class="host-group__chips">
                <span class="stat-chip stat-chip--total">{{ group.servers.length }}台</span>
                <span
                  v-if="group.offlineCount > 0"
                  class="stat-chip stat-chip--offline"
                >
                  {{ group.offlineCount }}台离线
                </span>
              </div>
            </div>
            <div class="host-group__grid">
              <server-card
                v-for="server in group.servers"
                :key="server.ID"
                compact
                :server="server"
                :cycle-transfer-map="cycleTransferMap"
                @select="onSelectServer"
              />
            </div>
          </section>

          <div v-if="displayGroups.length === 0" class="all-hosts-empty">
            <icon-inbox class="empty-icon" />
            <span>没有符合条件的服务器</span>
            <button
              v-if="isFiltered"
              type="button"
              class="all-hosts-empty__clear"
              @click="clearFilters"
            >
              清除筛选
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import {
  computed,
  ref,
  watch,
  onMounted,
  onUnmounted,
} from 'vue';
import { useStore } from 'vuex';
import ServerCard from '@/components/server-panel/server-card.vue';
import IconInbox from '@/components/icons/icon-inbox.vue';
import { getSystemOSLabel } from '@/utils/host';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
  },
  // 详情抽屉等上层浮层打开时禁用本弹窗的 Esc 关闭
  escapeDisabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'select-server']);

const FILTER_OPTIONS = [
  { label: '全部', value: '' },
  { label: '在线', value: '1', dot: 'online' },
  { label: '离线', value: '-1', dot: 'offline' },
];
const UNGROUPED_GROUP_KEY = '__ungrouped__';
const UNGROUPED_GROUP_LABEL = '未分组';

const store = useStore();
const searchKeyword = ref('');
const filterOnline = ref('');
const bodyRef = ref(null);

const serverCount = computed(() => store.state.serverCount || {
  total: 0,
  online: 0,
  offline: 0,
});

const serverGroups = computed(() => store.state.serverGroup || []);

function getServerSearchText(server) {
  return [
    server?.Name,
    server?.Host?.CountryCode,
    server?.PublicNote?.customData?.location,
    getSystemOSLabel(server?.Host?.Platform),
    server?.Host?.Platform,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const filteredServers = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  return (store.state.serverList || []).filter((server) => {
    if (filterOnline.value !== '' && String(server.online) !== filterOnline.value) {
      return false;
    }
    if (keyword && !getServerSearchText(server).includes(keyword)) {
      return false;
    }
    return true;
  });
});

const isFiltered = computed(() => (
  searchKeyword.value.trim() !== '' || filterOnline.value !== ''
));

const matchedCount = computed(() => filteredServers.value.length);

// 与右侧列表面板的分组 chips 保持一致：按 store 的 serverGroup 标签分组
const displayGroups = computed(() => {
  const groups = [];
  const assignedIds = new Set();

  const buildGroup = (key, label, servers) => {
    const onlineCount = servers.filter((s) => s.online === 1).length;
    return {
      key,
      label,
      servers,
      onlineCount,
      offlineCount: servers.length - onlineCount,
    };
  };

  serverGroups.value.forEach((group) => {
    const idSet = new Set((group.servers || []).map((id) => String(id)));
    const servers = filteredServers.value.filter((server) => {
      const isMember = idSet.has(String(server.ID));
      if (isMember) {
        assignedIds.add(String(server.ID));
      }
      return isMember;
    });
    if (servers.length > 0) {
      groups.push(buildGroup(group.name, group.name, servers));
    }
  });

  const ungroupedServers = filteredServers.value.filter(
    (server) => !assignedIds.has(String(server.ID)),
  );
  if (ungroupedServers.length > 0) {
    groups.push(buildGroup(UNGROUPED_GROUP_KEY, UNGROUPED_GROUP_LABEL, ungroupedServers));
  }

  return groups;
});

function scrollToGroup(index) {
  if (!bodyRef.value) {
    return;
  }
  const el = bodyRef.value.querySelector(`[data-group-index="${index}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function onSelectServer(server) {
  emit('select-server', server);
}

function handleClose() {
  emit('close');
}

function clearFilters() {
  searchKeyword.value = '';
  filterOnline.value = '';
}

watch(() => props.visible, (visible) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = visible ? 'hidden' : '';
  }
  if (visible) {
    searchKeyword.value = '';
    filterOnline.value = '';
  }
}, { immediate: true });

function handleKeydown(e) {
  if (e.key === 'Escape' && props.visible && !props.escapeDisabled) {
    handleClose();
  }
}

// 捕获阶段监听：上层抽屉的 esc 处理会同步复位 escapeDisabled，
// 冒泡阶段再判断会误关本弹窗
onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<style lang="scss" scoped>
.all-hosts-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(2, 7, 16, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.all-hosts-modal {
  position: relative;
  width: min(1680px, calc(100vw - 36px));
  height: calc(100vh - 36px);
  height: calc(100dvh - 36px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--globe-popup-border);
  background: var(--globe-popup-bg);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(24px) saturate(160%);
  color: var(--text-primary);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 60%),
      radial-gradient(ellipse at 0% 0%, rgba(var(--accent-cyan-rgb), 0.12), transparent 55%);
    pointer-events: none;
  }
}

.all-hosts-modal__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.all-hosts-modal__title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0;
  }
}

.all-hosts-modal__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 12px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
  background: rgba(var(--accent-primary-rgb), 0.1);
  color: var(--accent-primary);

  i {
    font-size: 18px;
    line-height: 1;
  }
}

.all-hosts-modal__close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--button-subtle-border);
  border-radius: 12px;
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

.summary-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  min-width: 0;
}

/* 汇总为纯文本样式，与右侧可点击的分组 chips 区分 */
.summary-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;

  i {
    font-size: 12px;
    line-height: 1;
    color: var(--accent-primary);
  }

  strong {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }

  &--online i {
    font-size: 8px;
    color: var(--accent-success);
  }

  &--offline i {
    font-size: 8px;
    color: var(--accent-danger);
  }
}

.summary-filter-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}

.summary-matched {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
}

.summary-clear-btn {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.24);
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.14);
  }
}

.all-hosts-modal__toolbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.all-hosts-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 220px;
  min-width: 0;
  min-height: 36px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  > i {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    color: var(--text-muted);
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;

    &::placeholder {
      color: var(--text-muted);
      font-weight: 500;
    }
  }

  &:focus-within {
    border-color: rgba(var(--accent-primary-rgb), 0.4);
  }
}

.all-hosts-search__clear {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--surface-subtle);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
}

.all-hosts-status-chips {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  @media (hover: hover) {
    &:hover:not(.active) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }

  &.active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
  }

  .status-chip__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  &.online:not(.active) .status-chip__dot {
    background: var(--accent-success);
  }

  &.offline:not(.active) .status-chip__dot {
    background: var(--accent-danger);
  }
}

.all-hosts-modal__groups-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 2px 0;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.groups-bar-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border-color);
}

.group-jump-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 160px;
  min-height: 26px;
  padding: 0 5px 0 10px;
  border-radius: 999px;
  border: 1px solid var(--panel-chip-border);
  background: var(--panel-chip-bg);
  color: var(--panel-chip-text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    border-color: rgba(var(--accent-primary-rgb), 0.35);
    background: rgba(var(--accent-primary-rgb), 0.08);
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 16px;
    padding: 0 5px;
    border-radius: 999px;
    background: rgba(var(--accent-primary-rgb), 0.12);
    color: var(--accent-primary);
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
}

.all-hosts-modal__body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 2px 10px 10px 2px;
  margin-right: -8px;
  scrollbar-gutter: stable;

  > * {
    flex-shrink: 0;
  }
}

.host-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-margin-top: 8px;
}

.host-group__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 0 2px;
}

.host-group__title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.host-group__chips {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  min-height: 21px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--globe-popup-chip-border);
  background: var(--globe-popup-chip-bg);
  font-size: 10px;
  font-weight: 600;
  color: var(--globe-popup-muted);
  white-space: nowrap;

  &--total {
    color: var(--text-primary);
  }

  &--offline {
    color: var(--accent-danger);
    border-color: rgba(var(--accent-danger-rgb), 0.28);
    background: rgba(var(--accent-danger-rgb), 0.08);
  }
}

.host-group__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}

.all-hosts-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;

  .empty-icon {
    font-size: 34px;
    opacity: 0.6;
  }
}

.all-hosts-empty__clear {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.24);
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.14);
  }
}

.all-hosts-fade-enter-active,
.all-hosts-fade-leave-active {
  transition:
    opacity var(--transition-normal),
    backdrop-filter var(--transition-normal);
}

.all-hosts-fade-enter-from,
.all-hosts-fade-leave-to {
  opacity: 0;
}

.all-hosts-fade-enter-active .all-hosts-modal,
.all-hosts-fade-leave-active .all-hosts-modal {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.all-hosts-fade-enter-from .all-hosts-modal,
.all-hosts-fade-leave-to .all-hosts-modal {
  opacity: 0;
  transform: translateY(18px) scale(0.97);
}

@media screen and (max-width: 640px) {
  .all-hosts-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .all-hosts-modal {
    width: 100%;
    height: calc(100vh - 24px);
    height: calc(100dvh - 24px);
    border-radius: 24px 24px 20px 20px;
    padding: 14px;
    gap: 8px;
  }

  .all-hosts-modal__header h3 {
    font-size: 16px;
  }

  .host-group__grid {
    grid-template-columns: 1fr;
  }

  .all-hosts-modal__body {
    gap: 12px;
    padding: 2px 8px 8px 0;
  }
}
</style>
