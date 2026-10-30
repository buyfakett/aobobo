<template>
  <div
    class="globe-effects-control"
    role="group"
    aria-label="地球特效显隐控制"
  >
    <button
      type="button"
      class="effect-toggle"
      :class="{ 'is-active': modelServerConnections }"
      :aria-pressed="modelServerConnections ? 'true' : 'false'"
      :title="modelServerConnections ? '隐藏服务器连线' : '显示服务器连线'"
      :aria-label="modelServerConnections ? '隐藏服务器连线' : '显示服务器连线'"
      @click="modelServerConnections = !modelServerConnections"
    >
      <i class="ri-node-tree" aria-hidden="true" />
      <span>连线</span>
    </button>
  </div>
</template>

<script setup>
const modelServerConnections = defineModel('serverConnections', {
  type: Boolean,
  default: true,
});
</script>

<style lang="scss" scoped>
.globe-effects-control {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  pointer-events: auto;
}

// Bright (accent-filled) = enabled, dim (muted, lowered opacity) = disabled.
.effect-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 22px;
  padding: 0 6px;
  border-radius: 8px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  opacity: 0.55;
  transition:
    opacity var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  i {
    font-size: 11px;
    line-height: 1;
  }

  @media (hover: hover) {
    &:hover {
      opacity: 0.85;
    }
  }

  &.is-active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--accent-primary-rgb), 0.45);
    outline-offset: 1px;
  }

  &:active {
    transform: translateY(1px);
  }
}

@media screen and (max-width: 768px) {
  .globe-effects-control {
    gap: 5px;
  }

  .effect-toggle {
    min-height: 20px;
    padding: 0 6px;
    font-size: 10.5px;
    gap: 3px;
  }
}
</style>
