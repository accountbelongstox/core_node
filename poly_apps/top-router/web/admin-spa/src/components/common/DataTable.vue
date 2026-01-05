<template>
  <div class="overflow-x-auto">
    <table
      class="min-w-full divide-y divide-slate-200 text-sm text-slate-700 dark:divide-slate-700 dark:text-slate-300"
    >
      <thead
        class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
      >
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="['px-4 py-3', column.thClass, getAlignClass(column.align)]"
            scope="col"
          >
            <slot :column="column" :name="`header-${column.key}`">
              {{ column.label }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        <tr v-if="loading">
          <td
            class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
            :colspan="columns.length"
          >
            <slot name="loading">
              <div class="flex items-center justify-center gap-2">
                <span class="loading-spinner h-4 w-4" />
                加载中...
              </div>
            </slot>
          </td>
        </tr>

        <tr v-else-if="!rows.length">
          <td
            class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
            :colspan="columns.length"
          >
            <slot name="empty">{{ emptyText }}</slot>
          </td>
        </tr>

        <template v-else>
          <template v-for="(row, rowIndex) in rows" :key="getRowKey(row, rowIndex)">
            <tr :class="getRowClass(row, rowIndex)">
              <td
                v-for="column in columns"
                :key="column.key"
                :class="['px-4 py-3 align-middle', column.tdClass, getAlignClass(column.align)]"
              >
                <slot
                  :column="column"
                  :name="`cell-${column.key}`"
                  :row="row"
                  :value="row[column.key]"
                >
                  {{ formatValue(row[column.key]) }}
                </slot>
              </td>
            </tr>
            <template v-if="$slots['row-after']">
              <slot :columns="columns" name="row-after" :row="row" :row-index="rowIndex" />
            </template>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup>
const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  rowClass: {
    type: [String, Function],
    default: ''
  }
})

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row, index)
  }
  return row?.[props.rowKey] ?? index
}

const alignClassMap = {
  center: 'text-center',
  right: 'text-right',
  left: 'text-left'
}

const getAlignClass = (align = 'left') => alignClassMap[align] || alignClassMap.left

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  return value
}

const baseRowClass = 'bg-white dark:bg-slate-900/60'
const getRowClass = (row, index) => {
  if (typeof props.rowClass === 'function') {
    const result = props.rowClass(row, index)
    return result ? `${baseRowClass} ${result}` : baseRowClass
  }
  if (typeof props.rowClass === 'string' && props.rowClass.trim()) {
    return `${baseRowClass} ${props.rowClass}`
  }
  return baseRowClass
}
</script>
