<template>
  <div class="clients-container">
    <div v-if="isWsClientOnly" class="card p-4 sm:p-6">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
            WS 客户端状态
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            当前节点以 WebSocket Client 模式运行，展示本机状态
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            :disabled="runtimeStore.adminLoading"
            @click="refreshLocalStatus"
          >
            <i
              :class="[
                'mr-1',
                runtimeStore.adminLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'
              ]"
            ></i>
            {{ runtimeStore.adminLoading ? '刷新中...' : '刷新' }}
          </button>
          <span v-if="runtimeStore.adminFetchedAt" class="text-xs text-gray-500 dark:text-gray-400">
            更新于 {{ formatTime(runtimeStore.adminFetchedAt) }}
          </span>
        </div>
      </div>

      <div v-if="runtimeStore.adminLoading" class="py-10 text-center text-sm text-gray-500">
        正在加载本机状态...
      </div>
      <div
        v-else-if="runtimeStore.adminError"
        class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200"
      >
        {{ runtimeStore.adminError }}
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-xl bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-gray-800/60">
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">连接状态</div>
          <div class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ localWsStatus.connected ? '已连接' : '未连接' }}
          </div>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            启用：{{ localWsStatus.enabled ? '是' : '否' }} · 注册：
            {{ localWsStatus.registered ? '是' : '否' }}
          </div>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Client ID：{{ localWsStatus.clientId || '-' }}
          </div>
        </div>
        <div class="rounded-xl bg-indigo-50 p-4 shadow-sm backdrop-blur-sm dark:bg-indigo-900/30">
          <div
            class="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200"
          >
            并发 / 队列
          </div>
          <div class="mt-2 text-lg font-semibold text-indigo-700 dark:text-indigo-200">
            {{ localWsStatus.concurrency?.activeRequests || 0 }} /
            {{ localWsStatus.concurrency?.maxConcurrency || 0 }}
          </div>
          <div class="mt-1 text-xs text-indigo-700/70 dark:text-indigo-200/70">
            队列：{{ localWsStatus.queue?.size || 0 }} · 待处理：
            {{ localWsStatus.queue?.pending || 0 }}
          </div>
          <div class="mt-1 text-xs text-indigo-700/70 dark:text-indigo-200/70">
            重连次数：{{ localWsStatus.reconnectAttempts || 0 }}
          </div>
        </div>
        <div class="rounded-xl bg-emerald-50 p-4 shadow-sm backdrop-blur-sm dark:bg-emerald-900/30">
          <div
            class="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200"
          >
            VPN 状态
          </div>
          <div class="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-200">
            {{ localVpnStatus.enabled ? '已启用' : '未启用' }}
          </div>
          <div class="mt-1 text-xs text-emerald-700/70 dark:text-emerald-200/70">
            运行：{{ localVpnStatus.running ? '是' : '否' }} · 初始化：
            {{ localVpnStatus.initialized ? '是' : '否' }}
          </div>
          <div class="mt-1 text-xs text-emerald-700/70 dark:text-emerald-200/70">
            运行时长：{{ formatDuration(localVpnStatus.uptime) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card p-4 sm:p-6">
      <!-- 页面标题和操作栏 -->
      <div class="mb-4 flex flex-col gap-4 sm:mb-6">
        <div>
          <h3 class="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100 sm:mb-2 sm:text-xl">
            Client 管理
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            管理 WebSocket Client 中间件连接和配置
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- 搜索框 -->
          <div class="group relative min-w-[200px]">
            <div
              class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
            ></div>
            <div class="relative flex items-center">
              <input
                v-model="searchKeyword"
                class="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm text-gray-700 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:hover:border-gray-500"
                placeholder="搜索 Client 名称..."
                type="text"
              />
              <i class="fas fa-search absolute left-3 text-sm text-cyan-500" />
              <button
                v-if="searchKeyword"
                class="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                @click="searchKeyword = ''"
              >
                <i class="fas fa-times text-xs" />
              </button>
            </div>
          </div>

          <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <!-- 自动刷新切换 -->
            <div
              class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:w-auto"
            >
              <div>
                <p class="font-medium text-gray-800 dark:text-gray-100">自动刷新</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {{ autoRefreshEnabled ? 'ON' : 'OFF' }}
                </span>
                <ToggleInput v-model="autoRefreshEnabled" :show-state-label="false" size="sm">
                  <span class="sr-only">自动刷新</span>
                </ToggleInput>
              </div>
            </div>

            <!-- 刷新按钮 -->
            <button
              class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:w-auto"
              :disabled="loading"
              @click="loadClients"
            >
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <i
                :class="[
                  'fas relative text-green-500',
                  loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'
                ]"
              />
              <span class="relative">刷新</span>
            </button>

            <!-- 添加 Client 按钮 -->
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-green-700 hover:shadow-lg sm:w-auto"
              @click="openCreateModal"
            >
              <i class="fas fa-plus"></i>
              <span>添加 Client</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading 状态 -->
      <div v-if="loading && clients.length === 0" class="py-12 text-center">
        <div class="loading-spinner mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400">正在加载 Clients...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredClients.length === 0 && !loading" class="py-12 text-center">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <i class="fas fa-network-wired text-xl text-gray-400" />
        </div>
        <p class="text-lg text-gray-500 dark:text-gray-400">
          {{ searchKeyword ? '未找到匹配的 Client' : '暂无 Client' }}
        </p>
        <p v-if="!searchKeyword" class="mt-2 text-sm text-gray-400 dark:text-gray-500">
          点击上方按钮添加您的第一个 WebSocket Client
        </p>
      </div>

      <!-- Clients 表格 -->
      <div v-else class="overflow-x-auto">
        <DataTable
          :columns="clientTableColumns"
          :loading="loading"
          row-key="id"
          :rows="filteredClients"
        >
          <template #cell-name="{ row }">
            <div class="flex flex-col">
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              <span v-if="row.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ row.description }}
              </span>
            </div>
          </template>

          <template #cell-status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                getStatusClass(row.status)
              ]"
            >
              <span class="h-2 w-2 rounded-full" :class="getStatusDotClass(row.status)"></span>
              {{ getStatusText(row.status) }}
            </span>
          </template>

          <template #cell-connectionStatus="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                getConnectionStatusClass(row.connectionStatus)
              ]"
            >
              {{ getConnectionStatusText(row.connectionStatus) }}
            </span>
          </template>

          <template #cell-concurrency="{ row }">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ row.currentConcurrency || 0 }} / {{ row.maxConcurrency }}
                </span>
              </div>
              <div class="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-gray-600">
                <div
                  class="h-1.5 rounded-full bg-blue-500 transition-all"
                  :style="{ width: getConcurrencyPercent(row) + '%' }"
                ></div>
              </div>
            </div>
          </template>

          <template #cell-supportedPlatforms="{ row }">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="platform in getSupportedPlatforms(row)"
                :key="platform"
                class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {{ platform }}
              </span>
            </div>
          </template>

          <template #cell-latency="{ row }">
            <span
              v-if="row.latency !== null && row.latency !== undefined"
              class="text-sm text-gray-700 dark:text-gray-300"
            >
              {{ row.latency }}ms
            </span>
            <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                title="查看详情"
                @click="viewDetails(row)"
              >
                <i class="fas fa-info-circle text-sm"></i>
              </button>
              <button
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-yellow-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-yellow-400"
                title="编辑"
                @click="editClient(row)"
              >
                <i class="fas fa-edit text-sm"></i>
              </button>
              <button
                v-if="row.connectionStatus === 'connected'"
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                title="配置管理"
                @click="openConfigModal(row)"
              >
                <i class="fas fa-cog text-sm"></i>
              </button>
              <button
                v-if="row.connectionStatus === 'connected'"
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-gray-400 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                title="配置历史"
                @click="openConfigHistory(row)"
              >
                <i class="fas fa-history text-sm"></i>
              </button>
              <button
                v-if="row.connectionStatus === 'connected'"
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-cyan-50 hover:text-cyan-600 dark:text-gray-400 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-400"
                title="账户列表"
                @click="openAccountsModal(row)"
              >
                <i class="fas fa-users text-sm"></i>
              </button>
              <button
                v-if="row.connectionStatus === 'connected'"
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:text-gray-400 dark:hover:bg-orange-900/20 dark:hover:text-orange-400"
                title="断开连接"
                @click="disconnectClient(row)"
              >
                <i class="fas fa-unlink text-sm"></i>
              </button>
              <button
                v-if="row.status === 'online' && row.connectionStatus === 'connected'"
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:text-gray-400 dark:hover:bg-teal-900/20 dark:hover:text-teal-300"
                title="系统健康"
                @click="openSystemHealthModal(row)"
              >
                <i class="fas fa-heartbeat text-sm"></i>
              </button>
              <button
                :class="[
                  'rounded-lg p-1.5 transition-colors',
                  row.schedulable
                    ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                ]"
                :title="row.schedulable ? '禁用调度' : '启用调度'"
                @click="toggleSchedulable(row)"
              >
                <i :class="['fas text-sm', row.schedulable ? 'fa-toggle-on' : 'fa-toggle-off']"></i>
              </button>
              <button
                class="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="删除"
                @click="deleteClient(row)"
              >
                <i class="fas fa-trash text-sm"></i>
              </button>
            </div>
          </template>

          <template #empty>
            <div class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">暂无 Client</div>
          </template>
        </DataTable>
      </div>
    </div>
  </div>

  <!-- Client 配置模态框 (NEW) -->
  <ClientConfigModal
    v-if="showConfigModal && selectedConfigClient"
    :client="selectedConfigClient"
    @close="handleCloseConfigModal"
    @saved="loadClients"
  />

  <!-- Client 账户列表模态框 (NEW) -->
  <ClientAccountsModal
    v-if="showAccountsModal && selectedAccountsClient"
    :client="selectedAccountsClient"
    @close="handleCloseAccountsModal"
  />

  <ClientConfigHistory
    v-if="showConfigHistoryModal && selectedHistoryClient"
    :client="selectedHistoryClient"
    @close="handleCloseConfigHistory"
  />

  <ClientSystemHealthModal
    v-if="showSystemHealthModal && selectedSystemHealthClient"
    :client="selectedSystemHealthClient"
    @close="handleCloseSystemHealthModal"
  />

  <!-- 创建/编辑 Client 模态框 -->
  <div
    v-if="showModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="closeModal"
  >
    <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
      <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
        {{ isEditing ? '编辑 Client' : '添加 Client' }}
      </h3>

      <form class="space-y-4" @submit.prevent="saveClient">
        <!-- API Key -->
        <FormField
          :description="isEditing ? 'API Key 不可修改' : '用于 Client 认证的密钥'"
          label="API Key"
          required
        >
          <input
            v-model="formData.apiKey"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            :disabled="isEditing"
            placeholder="输入 Client API Key"
            required
            type="text"
          />
        </FormField>

        <!-- 名称 -->
        <FormField description="在列表中展示的名称" label="名称" required>
          <input
            v-model="formData.name"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Client 名称"
            required
            type="text"
          />
        </FormField>

        <!-- 描述 -->
        <FormField description="可选，用于补充说明" label="描述">
          <textarea
            v-model="formData.description"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Client 描述"
            rows="2"
          ></textarea>
        </FormField>

        <!-- 支持的平台 -->
        <FormField description="至少选择一个可用平台" label="支持的平台">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="platform in availablePlatforms"
              :key="platform"
              :aria-pressed="formData.supportedPlatforms.includes(platform)"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all"
              :class="
                formData.supportedPlatforms.includes(platform)
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'border-gray-300 text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:text-gray-300'
              "
              type="button"
              @click="toggleSupportedPlatform(platform)"
            >
              <i
                :class="[
                  formData.supportedPlatforms.includes(platform)
                    ? 'fas fa-check-circle'
                    : 'far fa-circle',
                  formData.supportedPlatforms.includes(platform) ? 'text-blue-500' : 'text-gray-400'
                ]"
              ></i>
              <span>{{ platform }}</span>
            </button>
          </div>
        </FormField>

        <!-- 最大并发数 -->
        <FormField description="1-100，建议根据 Client 性能调整" label="最大并发数">
          <input
            v-model.number="formData.maxConcurrency"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            max="100"
            min="1"
            type="number"
          />
        </FormField>

        <!-- 优先级 -->
        <FormField description="数值越小优先级越高" label="优先级 (0-100)">
          <input
            v-model.number="formData.priority"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            max="100"
            min="0"
            type="number"
          />
        </FormField>

        <!-- 开关选项 -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField description="允许系统将任务派发给该 Client" label="可调度">
            <ToggleInput v-model="formData.schedulable" :show-state-label="false">
              启用调度
            </ToggleInput>
          </FormField>
          <FormField description="关闭后保留配置但不会参与调度" label="激活状态">
            <ToggleInput v-model="formData.isActive" :show-state-label="false">
              启用 Client
            </ToggleInput>
          </FormField>
        </div>

        <!-- 按钮 -->
        <div class="flex justify-end gap-3 pt-4">
          <button
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            type="button"
            @click="closeModal"
          >
            取消
          </button>
          <button
            class="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-blue-600 hover:to-blue-700"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Client 详情模态框 -->
  <div
    v-if="showDetailModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="showDetailModal = false"
  >
    <div class="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Client 详情</h3>
        <button
          class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="showDetailModal = false"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div v-if="selectedClient" class="space-y-4">
        <!-- 基本信息 -->
        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <h4 class="mb-3 font-semibold text-gray-900 dark:text-gray-100">基本信息</h4>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">ID</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ selectedClient.id }}</dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">名称</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ selectedClient.name }}</dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">账户类型</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                {{ selectedClient.accountType || 'shared' }}
              </dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">优先级</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                {{ selectedClient.priority || 50 }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- 连接信息 -->
        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <h4 class="mb-3 font-semibold text-gray-900 dark:text-gray-100">连接信息</h4>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">连接状态</dt>
              <dd class="mt-1">
                <span
                  :class="[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                    getConnectionStatusClass(selectedClient.connectionStatus)
                  ]"
                >
                  {{ getConnectionStatusText(selectedClient.connectionStatus) }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">最后心跳</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                {{
                  selectedClient.lastHeartbeatAt ? formatTime(selectedClient.lastHeartbeatAt) : '-'
                }}
              </dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">延迟</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                {{
                  selectedClient.latency !== null && selectedClient.latency !== undefined
                    ? selectedClient.latency + 'ms'
                    : '-'
                }}
              </dd>
            </div>
            <div>
              <dt class="font-medium text-gray-500 dark:text-gray-400">错误计数</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                {{ selectedClient.errorCount || 0 }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- 能力信息 -->
        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <h4 class="mb-3 font-semibold text-gray-900 dark:text-gray-100">能力信息</h4>
          <div class="space-y-3">
            <div>
              <dt class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">支持的平台</dt>
              <dd class="flex flex-wrap gap-2">
                <span
                  v-for="platform in getSupportedPlatforms(selectedClient)"
                  :key="platform"
                  class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {{ platform }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">并发配置</dt>
              <dd class="text-sm text-gray-900 dark:text-gray-100">
                当前: {{ selectedClient.currentConcurrency || 0 }} / 最大:
                {{ selectedClient.maxConcurrency }} (可用: {{ selectedClient.availableSlots || 0 }})
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { showToast } from '@/utils/toast'
import { apiClient } from '@/config/api'
import { useRuntimeStore } from '@/stores/runtime'
import ClientConfigModal from '@/components/clients/ClientConfigModal.vue'
import ClientAccountsModal from '@/components/clients/ClientAccountsModal.vue'
import ClientSystemHealthModal from '@/components/clients/ClientSystemHealthModal.vue'
import ClientConfigHistory from '@/components/clients/ClientConfigHistory.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/form/FormField.vue'
import ToggleInput from '@/components/common/form/ToggleInput.vue'

const runtimeStore = useRuntimeStore()

// 数据状态
const clients = ref([])
const loading = ref(false)
const searchKeyword = ref('')
const refreshInterval = ref(null)
const autoRefreshEnabled = ref(false)
const isWsClientOnly = computed(() => runtimeStore.isWsClientOnly)
const localWsStatus = computed(() => runtimeStore.wsClientStatus || {})
const localVpnStatus = computed(
  () => runtimeStore.vpnClientStatus || runtimeStore.wsClientStatus?.vpn || {}
)

// 模态框状态
const showModal = ref(false)
const showDetailModal = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const selectedClient = ref(null)
const showConfigModal = ref(false)
const showAccountsModal = ref(false)
const selectedConfigClient = ref(null)
const selectedAccountsClient = ref(null)
const showSystemHealthModal = ref(false)
const selectedSystemHealthClient = ref(null)
const showConfigHistoryModal = ref(false)
const selectedHistoryClient = ref(null)

// 表单数据
const formData = ref({
  apiKey: '',
  name: '',
  description: '',
  supportedPlatforms: ['claude', 'gemini', 'openai'],
  maxConcurrency: 10,
  priority: 50,
  schedulable: true,
  isActive: true
})

const toggleSupportedPlatform = (platform) => {
  const current = formData.value.supportedPlatforms || []
  if (current.includes(platform)) {
    formData.value.supportedPlatforms = current.filter((value) => value !== platform)
  } else {
    formData.value.supportedPlatforms = [...current, platform]
  }
}

// 可用平台
const availablePlatforms = ['claude', 'gemini', 'openai', 'bedrock', 'azure', 'droid']
const clientTableColumns = [
  { key: 'name', label: '名称' },
  { key: 'status', label: '状态' },
  { key: 'connectionStatus', label: '连接状态' },
  { key: 'concurrency', label: '并发' },
  { key: 'supportedPlatforms', label: '支持平台' },
  { key: 'latency', label: '延迟' },
  { key: 'actions', label: '操作', align: 'right' }
]

// 过滤后的 Clients
const filteredClients = computed(() => {
  if (!searchKeyword.value) return clients.value

  const keyword = searchKeyword.value.toLowerCase()
  return clients.value.filter(
    (client) =>
      client.name?.toLowerCase().includes(keyword) ||
      client.description?.toLowerCase().includes(keyword) ||
      client.id?.toLowerCase().includes(keyword)
  )
})

const refreshLocalStatus = async () => {
  try {
    await runtimeStore.fetchAdminRuntimeInfo(true)
  } catch (error) {
    showToast('加载本机状态失败: ' + error.message, 'error')
  }
}

// 加载 Clients
const loadClients = async () => {
  loading.value = true
  try {
    const response = await apiClient.get('/admin/clients')
    if (response.success) {
      clients.value = response.data
    } else {
      showToast('加载 Clients 失败', 'error')
    }
  } catch (error) {
    console.error('Failed to load clients:', error)
    showToast('加载 Clients 失败: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}

// 打开创建模态框
const openCreateModal = () => {
  isEditing.value = false
  formData.value = {
    apiKey: '',
    name: '',
    description: '',
    supportedPlatforms: ['claude', 'gemini', 'openai'],
    maxConcurrency: 10,
    priority: 50,
    schedulable: true,
    isActive: true
  }
  showModal.value = true
}

// 编辑 Client
const editClient = (client) => {
  isEditing.value = true
  formData.value = {
    id: client.id,
    apiKey: client.apiKey || '',
    name: client.name,
    description: client.description || '',
    supportedPlatforms: client.supportedPlatforms || ['claude', 'gemini', 'openai'],
    maxConcurrency: client.maxConcurrency || 10,
    priority: client.priority !== undefined ? client.priority : 50,
    schedulable: client.schedulable !== false,
    isActive: client.isActive !== false
  }
  showModal.value = true
}

// 保存 Client
const saveClient = async () => {
  submitting.value = true
  try {
    if (isEditing.value) {
      // 更新
      const response = await apiClient.put(`/admin/clients/${formData.value.id}`, formData.value)
      if (response.success) {
        showToast('Client 更新成功', 'success')
        closeModal()
        loadClients()
      } else {
        showToast('更新失败: ' + response.error, 'error')
      }
    } else {
      // 创建
      const response = await apiClient.post('/admin/clients', formData.value)
      if (response.success) {
        showToast('Client 创建成功', 'success')
        closeModal()
        loadClients()
      } else {
        showToast('创建失败: ' + response.error, 'error')
      }
    }
  } catch (error) {
    console.error('Failed to save client:', error)
    showToast('保存失败: ' + error.message, 'error')
  } finally {
    submitting.value = false
  }
}

// 关闭模态框
const closeModal = () => {
  showModal.value = false
  formData.value = {
    apiKey: '',
    name: '',
    description: '',
    supportedPlatforms: ['claude', 'gemini', 'openai'],
    maxConcurrency: 10,
    priority: 50,
    schedulable: true,
    isActive: true
  }
}

// 删除 Client
const deleteClient = async (client) => {
  if (!confirm(`确定要删除 Client "${client.name}" 吗？此操作无法撤销。`)) {
    return
  }

  try {
    const response = await apiClient.delete(`/admin/clients/${client.id}`)
    if (response.success) {
      showToast('Client 已删除', 'success')
      loadClients()
    } else {
      showToast('删除失败: ' + response.error, 'error')
    }
  } catch (error) {
    console.error('Failed to delete client:', error)
    showToast('删除失败: ' + error.message, 'error')
  }
}

// 断开 Client 连接 (NEW)
const disconnectClient = async (client) => {
  if (
    !confirm(
      `确定要断开 Client "${client.name}" 的连接吗？\n\n这将立即终止该 Client 的 WebSocket 连接。`
    )
  ) {
    return
  }

  try {
    const response = await apiClient.post(`/admin/clients/${client.id}/disconnect`, {
      reason: 'admin_manual_disconnect'
    })

    if (response.success) {
      showToast(`Client "${client.name}" 已断开连接`, 'success')
      loadClients() // 刷新列表查看状态变化
    } else {
      if (response.error && response.error.includes('not available')) {
        showToast('WebSocket 服务不可用', 'warning')
      } else if (response.error && response.error.includes('not found')) {
        showToast('Client 不存在', 'error')
      } else {
        showToast('断开连接失败: ' + response.error, 'error')
      }
    }
  } catch (error) {
    console.error('Failed to disconnect client:', error)
    showToast('断开连接失败: ' + error.message, 'error')
  }
}

// 切换调度状态
const toggleSchedulable = async (client) => {
  try {
    const response = await apiClient.put(`/admin/clients/${client.id}/toggle-schedulable`)
    if (response.success) {
      showToast(`已${client.schedulable ? '禁用' : '启用'}调度`, 'success')
      loadClients()
    } else {
      showToast('操作失败: ' + response.error, 'error')
    }
  } catch (error) {
    console.error('Failed to toggle schedulable:', error)
    showToast('操作失败: ' + error.message, 'error')
  }
}

// 查看详情
const viewDetails = (client) => {
  selectedClient.value = client
  showDetailModal.value = true
}

// 打开配置模态框 (NEW)
const openConfigModal = (client) => {
  selectedConfigClient.value = client
  showConfigModal.value = true
}

// 关闭配置模态框 (NEW)
const handleCloseConfigModal = () => {
  showConfigModal.value = false
  selectedConfigClient.value = null
}

// 打开账户列表模态框 (NEW)
const openAccountsModal = (client) => {
  selectedAccountsClient.value = client
  showAccountsModal.value = true
}

// 关闭账户列表模态框 (NEW)
const handleCloseAccountsModal = () => {
  showAccountsModal.value = false
  selectedAccountsClient.value = null
}

const openConfigHistory = (client) => {
  selectedHistoryClient.value = client
  showConfigHistoryModal.value = true
}

const handleCloseConfigHistory = () => {
  showConfigHistoryModal.value = false
  selectedHistoryClient.value = null
}

const openSystemHealthModal = (client) => {
  selectedSystemHealthClient.value = client
  showSystemHealthModal.value = true
}

const handleCloseSystemHealthModal = () => {
  showSystemHealthModal.value = false
  selectedSystemHealthClient.value = null
}

// 辅助函数 - 状态样式
const getStatusClass = (status) => {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'offline':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'blocked':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getStatusDotClass = (status) => {
  switch (status) {
    case 'online':
      return 'bg-green-500'
    case 'offline':
      return 'bg-gray-500'
    case 'error':
      return 'bg-red-500'
    case 'blocked':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-500'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'online':
      return '在线'
    case 'offline':
      return '离线'
    case 'error':
      return '错误'
    case 'blocked':
      return '阻塞'
    default:
      return status || '未知'
  }
}

// 连接状态样式
const getConnectionStatusClass = (status) => {
  switch (status) {
    case 'connected':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'disconnected':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'connecting':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getConnectionStatusText = (status) => {
  switch (status) {
    case 'connected':
      return '已连接'
    case 'disconnected':
      return '未连接'
    case 'connecting':
      return '连接中'
    default:
      return status || '未知'
  }
}

// 获取支持的平台列表
const getSupportedPlatforms = (client) => {
  // 优先使用 capabilities.supportedPlatforms，如果为空则使用 supportedPlatforms
  if (client.capabilities?.supportedPlatforms?.length > 0) {
    return client.capabilities.supportedPlatforms
  }
  return client.supportedPlatforms || []
}

// 计算并发百分比
const getConcurrencyPercent = (client) => {
  if (!client.maxConcurrency) return 0
  return Math.min(100, ((client.currentConcurrency || 0) / client.maxConcurrency) * 100)
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  } catch {
    return timestamp
  }
}

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

const restartAutoRefresh = () => {
  stopAutoRefresh()
  if (autoRefreshEnabled.value) {
    refreshInterval.value = setInterval(() => {
      loadClients()
    }, 5000)
  }
}

watch(
  autoRefreshEnabled,
  (enabled) => {
    if (isWsClientOnly.value) {
      return
    }
    if (enabled) {
      loadClients()
      restartAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  },
  { immediate: false }
)

// 生命周期钩子
onMounted(async () => {
  try {
    await runtimeStore.fetchRuntimeInfo()
  } catch (_) {
    // ignore runtime errors, fall back to normal behavior
  }

  if (isWsClientOnly.value) {
    await refreshLocalStatus()
    return
  }

  loadClients()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.clients-container {
  @apply min-h-screen;
}

.card {
  @apply rounded-xl bg-white shadow-lg dark:bg-gray-800;
}

.loading-spinner {
  @apply h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600;
}
</style>
