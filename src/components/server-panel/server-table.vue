<template>
  <div class="server-table-wrap">
    <server-card
      v-for="server in servers"
      :key="server.ID"
      :server="server"
      :cycle-transfer-map="cycleTransferMap"
      @select="goDetail"
      @hover-server="onRowHover"
    />
  </div>
</template>

<script setup>
import ServerCard from '@/components/server-panel/server-card.vue';

defineProps({
  servers: {
    type: Array,
    default: () => [],
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['hover-server', 'select-server']);

function goDetail(server) {
  emit('select-server', server);
}

function onRowHover(server) {
  emit('hover-server', server);
}
</script>

<style lang="scss" scoped>
.server-table-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px 14px;
  color: var(--text-primary);
  scrollbar-gutter: stable;
}

@media screen and (max-width: 768px) {
  .server-table-wrap {
    padding: 12px;
    gap: 6px;
  }
}
</style>
