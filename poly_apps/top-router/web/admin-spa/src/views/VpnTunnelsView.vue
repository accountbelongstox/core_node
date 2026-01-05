<template>
  <div class="tab-content">
    <div class="card space-y-4 p-4 sm:p-6">
      <template v-if="isWsClientOnly">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              VPN 状态（本机）
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              WebSocket Client 模式下仅展示当前节点的 VPN 运行状态
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              :disabled="runtimeStore.adminLoading"
              @click="refresh"
            >
              <i
                :class="[
                  'mr-1',
                  runtimeStore.adminLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'
                ]"
              ></i>
              {{ runtimeStore.adminLoading ? '刷新中...' : '刷新' }}
            </button>
            <span
              v-if="runtimeStore.adminFetchedAt"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              更新于 {{ formatRelativeTime(runtimeStore.adminFetchedAt) }}
            </span>
          </div>
        </div>

        <div v-if="runtimeStore.adminLoading" class="py-8 text-center text-sm text-gray-500">
          正在加载本机 VPN 状态...
        </div>
        <div
          v-else-if="runtimeStore.adminError"
          class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200"
        >
          {{ runtimeStore.adminError }}
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-gray-800/60">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">运行状态</div>
            <div class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ localVpnStatus.enabled ? '已启用' : '未启用' }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              运行：{{ localVpnStatus.running ? '是' : '否' }} · 初始化：
              {{ localVpnStatus.initialized ? '是' : '否' }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              运行时长：{{ formatDuration(localVpnStatus.uptime) }}
            </div>
          </div>
          <div
            class="rounded-xl bg-emerald-50 p-4 shadow-sm backdrop-blur-sm dark:bg-emerald-900/30"
          >
            <div
              class="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200"
            >
              组件状态
            </div>
            <div class="mt-2 text-sm text-emerald-800 dark:text-emerald-100">
              SessionController：{{ localVpnStatus.components?.sessionController ? 'OK' : '—' }}
            </div>
            <div class="mt-1 text-sm text-emerald-800 dark:text-emerald-100">
              BufferPool：{{ localVpnStatus.components?.bufferPool ? 'OK' : '—' }}
            </div>
            <div class="mt-1 text-sm text-emerald-800 dark:text-emerald-100">
              Metrics：{{ localVpnStatus.components?.metrics ? 'OK' : '—' }}
            </div>
            <div class="mt-2 text-xs text-emerald-700/70 dark:text-emerald-200/70">
              Client ID：{{ localWsStatus.clientId || '-' }}
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">VPN 隧道</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              查看隧道状态、握手错误码和实时统计，便于排查客户端/服务端契约问题
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              :disabled="vpnStore.loading"
              @click="refresh"
            >
              <i
                :class="['mr-1', vpnStore.loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt']"
              ></i>
              {{ vpnStore.loading ? '刷新中...' : '刷新' }}
            </button>
            <span v-if="vpnStore.lastUpdatedAt" class="text-xs text-gray-500 dark:text-gray-400">
              更新于 {{ formatRelativeTime(vpnStore.lastUpdatedAt) }}
            </span>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-gray-800/60">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">隧道总数</div>
            <div class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
              {{ vpnStore.tunnels.length }}
            </div>
          </div>
          <div class="rounded-xl bg-green-50 p-4 shadow-sm backdrop-blur-sm dark:bg-green-900/30">
            <div
              class="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-200"
            >
              活跃隧道
            </div>
            <div class="mt-2 text-2xl font-bold text-green-700 dark:text-green-200">
              {{ vpnStore.activeCount }}
            </div>
          </div>
          <div class="rounded-xl bg-indigo-50 p-4 shadow-sm backdrop-blur-sm dark:bg-indigo-900/30">
            <div
              class="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200"
            >
              活跃连接
            </div>
            <div class="mt-2 text-2xl font-bold text-indigo-700 dark:text-indigo-200">
              {{ vpnStore.totalActiveConnections }}
            </div>
          </div>
          <div class="rounded-xl bg-rose-50 p-4 shadow-sm backdrop-blur-sm dark:bg-rose-900/30">
            <div
              class="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200"
            >
              握手失败/错误
            </div>
            <div class="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-200">
              {{ vpnStore.failingCount }}
            </div>
          </div>
        </div>

        <div
          class="rounded-2xl border border-gray-100 bg-white/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
        >
          <div
            class="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">隧道列表</div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                @click="toggleCreate"
              >
                <i class="fas fa-plus mr-1"></i>
                新建
              </button>
              <button
                class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                :disabled="purging"
                @click="purge"
              >
                <i :class="['mr-1', purging ? 'fas fa-spinner fa-spin' : 'fas fa-broom']"></i>
                过期清理
              </button>
              <div class="text-xs text-gray-500 dark:text-gray-400">双击行查看详情</div>
            </div>
          </div>

          <div v-if="vpnStore.loading" class="p-4 text-sm text-gray-500 dark:text-gray-400">
            正在加载隧道信息...
          </div>
          <div v-else-if="vpnStore.error" class="p-4 text-sm text-rose-600 dark:text-rose-300">
            {{ vpnStore.error }}
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead class="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    隧道
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    客户端
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    端口
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    状态 / 错误码
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    连接
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    流量
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    最后握手/错误
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr
                  v-for="tunnel in sortedTunnels"
                  :key="tunnel.tunnelId"
                  class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  @click="selectTunnel(tunnel.tunnelId)"
                  @dblclick="selectTunnel(tunnel.tunnelId)"
                >
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs text-gray-800 dark:text-gray-100">
                      {{ tunnel.tunnelId }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ tunnel.notes || '—' }}
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {{ tunnel.clientId || 'default' }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      状态：{{ tunnel.status || 'unknown' }}
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                    {{ tunnel.socks5Port || '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                      :class="statusBadgeClass(tunnel.status)"
                    >
                      {{ tunnel.status || 'unknown' }}
                    </span>
                    <div
                      v-if="tunnel.stats?.lastErrorCode"
                      class="mt-1 text-xs text-rose-600 dark:text-rose-300"
                    >
                      {{ tunnel.stats.lastErrorCode }}
                    </div>
                    <div v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">—</div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                    <div class="font-semibold">{{ tunnel.stats?.activeConnections || 0 }} 活跃</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      累计 {{ tunnel.stats?.totalConnections || 0 }}
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                    <div>{{ formatBytes(tunnel.stats?.totalBytesOut || 0) }} ⬇</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatBytes(tunnel.stats?.totalBytesIn || 0) }} ⬆
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                    <div v-if="tunnel.stats?.lastHandshakeAt">
                      握手 {{ formatRelativeTime(tunnel.stats.lastHandshakeAt) }}
                    </div>
                    <div v-else class="text-xs text-gray-500 dark:text-gray-400">未握手</div>
                    <div
                      v-if="tunnel.stats?.lastErrorAt"
                      class="text-xs text-rose-600 dark:text-rose-300"
                    >
                      错误 {{ formatRelativeTime(tunnel.stats.lastErrorAt) }}
                    </div>
                  </td>
                </tr>
                <tr v-if="sortedTunnels.length === 0">
                  <td
                    class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                    colspan="7"
                  >
                    暂无隧道数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-if="selectedTunnel"
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
        >
          <div class="mb-3 flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                选中隧道：{{ selectedTunnel.tunnelId }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                客户端 {{ selectedTunnel.clientId || 'default' }} · 端口
                {{ selectedTunnel.socks5Port || '—' }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="statusBadgeClass(selectedTunnel.status)"
              >
                {{ selectedTunnel.status || 'unknown' }}
              </span>
              <button
                class="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-600"
                @click="handleDelete(selectedTunnel.tunnelId)"
              >
                删除
              </button>
              <button
                class="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-600"
                @click="resetStats"
              >
                清空统计
              </button>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
              <div class="text-xs text-gray-500 dark:text-gray-400">握手统计</div>
              <div class="mt-1 text-sm text-gray-800 dark:text-gray-100">
                成功 {{ selectedTunnel.stats?.handshakeSuccesses || 0 }} / 失败
                {{ selectedTunnel.stats?.handshakeFailures || 0 }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                最后握手
                {{
                  selectedTunnel.stats?.lastHandshakeAt
                    ? formatDate(selectedTunnel.stats.lastHandshakeAt)
                    : '—'
                }}
              </div>
            </div>

            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
              <div class="text-xs text-gray-500 dark:text-gray-400">错误码</div>
              <div class="mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300">
                {{ selectedTunnel.stats?.lastErrorCode || '无' }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ selectedTunnel.stats?.lastErrorMessage || '—' }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{
                  selectedTunnel.stats?.lastErrorAt
                    ? formatDate(selectedTunnel.stats.lastErrorAt)
                    : ''
                }}
              </div>
            </div>

            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
              <div class="text-xs text-gray-500 dark:text-gray-400">连接 / 流量</div>
              <div class="mt-1 text-sm text-gray-800 dark:text-gray-100">
                活跃 {{ selectedTunnel.stats?.activeConnections || 0 }} · 累计
                {{ selectedTunnel.stats?.totalConnections || 0 }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                ↓ {{ formatBytes(selectedTunnel.stats?.totalBytesOut || 0) }} · ↑
                {{ formatBytes(selectedTunnel.stats?.totalBytesIn || 0) }}
              </div>
            </div>
          </div>

          <div v-if="selectedTunnel.notes" class="mt-3 text-sm text-gray-700 dark:text-gray-200">
            备注：{{ selectedTunnel.notes }}
          </div>

          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <div
              class="rounded-xl border border-gray-100 bg-white/80 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
            >
              <div class="mb-2 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">活跃会话</div>
                <button
                  class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-300"
                  :disabled="sessionsLoading"
                  @click="loadSessions(selectedTunnel.tunnelId)"
                >
                  <i
                    :class="[
                      'mr-1',
                      sessionsLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'
                    ]"
                  ></i>
                  刷新
                </button>
              </div>
              <div v-if="sessionsLoading" class="text-xs text-gray-500 dark:text-gray-400">
                正在加载会话...
              </div>
              <div v-else>
                <div
                  v-if="(vpnStore.sessions[selectedTunnel.tunnelId] || []).length === 0"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  暂无会话
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="session in vpnStore.sessions[selectedTunnel.tunnelId]"
                    :key="session.sessionId"
                    class="rounded-lg border border-gray-100 bg-white/70 p-2 text-xs dark:border-gray-800 dark:bg-gray-800/60"
                  >
                    <div class="flex flex-wrap justify-between gap-2">
                      <div class="font-mono text-gray-800 dark:text-gray-100">
                        {{ session.sessionId }}
                      </div>
                      <div class="text-gray-500 dark:text-gray-400">
                        {{ session.targetHost }}:{{ session.targetPort }}
                      </div>
                    </div>
                    <div class="mt-1 flex flex-wrap gap-2 text-gray-500 dark:text-gray-400">
                      <span>源 {{ session.sourceIp }}:{{ session.sourcePort }}</span>
                      <span>⬆ {{ formatBytes(session.bytesUp || 0) }}</span>
                      <span>⬇ {{ formatBytes(session.bytesDown || 0) }}</span>
                      <span class="text-xxs">状态：{{ session.status }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="rounded-xl border border-gray-100 bg-white/80 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
            >
              <div class="mb-2 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  握手 / 错误时间线
                </div>
                <button
                  class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-300"
                  :disabled="eventsLoading"
                  @click="loadEvents(selectedTunnel.tunnelId)"
                >
                  <i
                    :class="['mr-1', eventsLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt']"
                  ></i>
                  刷新
                </button>
              </div>
              <div v-if="eventsLoading" class="text-xs text-gray-500 dark:text-gray-400">
                正在加载时间线...
              </div>
              <div v-else>
                <div
                  v-if="(vpnStore.events[selectedTunnel.tunnelId] || []).length === 0"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  暂无事件
                </div>
                <ul v-else class="space-y-2 text-xs">
                  <li
                    v-for="item in vpnStore.events[selectedTunnel.tunnelId]"
                    :key="item.at + (item.errorCode || item.type)"
                    class="rounded-lg border border-gray-100 bg-white/70 p-2 dark:border-gray-800 dark:bg-gray-800/60"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-gray-800 dark:text-gray-100">
                        {{
                          item.type === 'handshake'
                            ? item.success
                              ? '握手成功'
                              : '握手失败'
                            : '错误'
                        }}
                      </span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400">
                        {{ formatRelativeTime(item.at) }}
                      </span>
                    </div>
                    <div class="text-gray-500 dark:text-gray-400">
                      <span v-if="item.errorCode" class="text-rose-500 dark:text-rose-300">
                        {{ item.errorCode }}
                      </span>
                      <span v-if="item.message" class="ml-1">{{ item.message }}</span>
                    </div>
                    <div v-if="item.latencyMs" class="text-[10px] text-gray-500 dark:text-gray-400">
                      RTT: {{ item.latencyMs }} ms
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="actionError"
          class="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200"
        >
          {{ actionError }}
        </div>

        <div
          v-if="showCreate"
          class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div class="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="text-base font-semibold text-gray-900 dark:text-gray-100">新建隧道</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  最简配置：客户端 ID、备注，可选指定端口/过期时间
                </div>
              </div>
              <button
                class="text-gray-500 hover:text-gray-800 dark:text-gray-400"
                @click="toggleCreate"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600 dark:text-gray-400">客户端 ID</label>
                <input
                  v-model="form.clientId"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="如 default"
                  type="text"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600 dark:text-gray-400">端口（可选）</label>
                <input
                  v-model.number="form.port"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  min="1"
                  placeholder="自动分配留空"
                  type="number"
                />
              </div>
              <div class="flex flex-col gap-1 sm:col-span-2">
                <label class="text-xs text-gray-600 dark:text-gray-400">备注</label>
                <input
                  v-model="form.notes"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="例如环境/用途"
                  type="text"
                />
              </div>
              <div class="flex flex-col gap-1 sm:col-span-2">
                <label class="text-xs text-gray-600 dark:text-gray-400">过期时间（可选）</label>
                <input
                  v-model="form.expiresAt"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  type="datetime-local"
                />
              </div>
            </div>

            <div v-if="actionError" class="mt-2 text-xs text-rose-600 dark:text-rose-300">
              {{ actionError }}
            </div>

            <div class="mt-4 flex justify-end gap-2">
              <button
                class="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300"
                @click="toggleCreate"
              >
                取消
              </button>
              <button
                class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                :disabled="saving"
                @click="handleCreate"
              >
                <i :class="['mr-1', saving ? 'fas fa-spinner fa-spin' : 'fas fa-check']"></i>
                保存
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVpnStore } from '@/stores/vpn'
import { useRuntimeStore } from '@/stores/runtime'
import { formatBytes, formatDate, formatRelativeTime } from '@/utils/format'

const vpnStore = useVpnStore()
const runtimeStore = useRuntimeStore()
const selectedTunnelId = ref(null)
const showCreate = ref(false)
const saving = ref(false)
const purging = ref(false)
const actionError = ref('')
const sessionsLoading = ref(false)
const eventsLoading = ref(false)
const timelineLimit = 20
const form = ref({
  clientId: '',
  port: null,
  notes: '',
  expiresAt: ''
})

const isWsClientOnly = computed(() => runtimeStore.isWsClientOnly)
const localVpnStatus = computed(() => runtimeStore.vpnClientStatus || {})
const localWsStatus = computed(() => runtimeStore.wsClientStatus || {})

const sortedTunnels = computed(() => {
  const list = [...vpnStore.tunnels]
  return list.sort((a, b) => {
    const aTime = a?.stats?.lastUpdatedAt || a?.stats?.lastHandshakeAt || 0
    const bTime = b?.stats?.lastUpdatedAt || b?.stats?.lastHandshakeAt || 0
    return bTime - aTime
  })
})

const selectedTunnel = computed(() => {
  if (selectedTunnelId.value) {
    return sortedTunnels.value.find((t) => t.tunnelId === selectedTunnelId.value) || null
  }
  return sortedTunnels.value.length > 0 ? sortedTunnels.value[0] : null
})

const statusBadgeClass = (status) => {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'active') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-200'
  }
  if (normalized === 'error' || normalized === 'expired') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800/70 dark:text-gray-200'
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

const selectTunnel = (id) => {
  selectedTunnelId.value = id
}

const refresh = async () => {
  if (isWsClientOnly.value) {
    await refreshLocalStatus()
    return
  }
  await vpnStore.fetchTunnels()
  if (selectedTunnelId.value) {
    await Promise.all([loadSessions(selectedTunnelId.value), loadEvents(selectedTunnelId.value)])
  }
}

const refreshLocalStatus = async () => {
  try {
    await runtimeStore.fetchAdminRuntimeInfo(true)
  } catch (_) {
    // ignore errors here, UI shows adminError
  }
}

let refreshTimer = null

onMounted(async () => {
  try {
    await runtimeStore.fetchRuntimeInfo()
  } catch (_) {
    // ignore runtime errors, fall back to normal behavior
  }

  if (isWsClientOnly.value) {
    await refreshLocalStatus()
    refreshTimer = setInterval(() => refreshLocalStatus(), 30000)
  } else {
    try {
      await vpnStore.fetchTunnels()
    } catch (_) {
      // 错误已在 store 中处理
    }
    refreshTimer = setInterval(() => refresh(), 30000)
  }

  if (typeof refreshTimer?.unref === 'function') {
    refreshTimer.unref()
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

const toggleCreate = () => {
  actionError.value = ''
  showCreate.value = !showCreate.value
}

const handleCreate = async () => {
  saving.value = true
  actionError.value = ''
  try {
    const payload = {
      clientId: form.value.clientId || 'default',
      port: form.value.port || undefined,
      notes: form.value.notes || '',
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).getTime() : undefined
    }
    await vpnStore.createTunnel(payload)
    showCreate.value = false
    form.value = { clientId: '', port: null, notes: '', expiresAt: '' }
  } catch (err) {
    actionError.value = err?.message || '创建失败'
  } finally {
    saving.value = false
  }
}

const handleDelete = async (tunnelId) => {
  if (!tunnelId) return
  if (!window.confirm('确定删除该隧道吗？')) return
  try {
    await vpnStore.deleteTunnel(tunnelId)
    if (selectedTunnelId.value === tunnelId) {
      selectedTunnelId.value = null
    }
  } catch (err) {
    actionError.value = err?.message || '删除失败'
  }
}

const purge = async () => {
  purging.value = true
  actionError.value = ''
  try {
    await vpnStore.purgeExpired()
    if (selectedTunnelId.value) {
      await Promise.all([loadSessions(selectedTunnelId.value), loadEvents(selectedTunnelId.value)])
    }
  } catch (err) {
    actionError.value = err?.message || '清理失败'
  } finally {
    purging.value = false
  }
}

const loadSessions = async (tunnelId) => {
  if (!tunnelId) return []
  sessionsLoading.value = true
  try {
    return await vpnStore.fetchSessions(tunnelId)
  } catch (_) {
    return []
  } finally {
    sessionsLoading.value = false
  }
}

const loadEvents = async (tunnelId) => {
  if (!tunnelId) return []
  eventsLoading.value = true
  try {
    return await vpnStore.fetchEvents(tunnelId, timelineLimit)
  } catch (_) {
    return []
  } finally {
    eventsLoading.value = false
  }
}

watch(
  () => selectedTunnelId.value,
  (id) => {
    if (id) {
      loadSessions(id)
      loadEvents(id)
    }
  },
  { immediate: true }
)

const resetStats = async () => {
  if (!selectedTunnelId.value) return
  if (!window.confirm('清空该隧道的统计与事件记录？')) return
  try {
    await vpnStore.resetTunnelStats(selectedTunnelId.value)
    await Promise.all([loadSessions(selectedTunnelId.value), loadEvents(selectedTunnelId.value)])
  } catch (err) {
    actionError.value = err?.message || '重置失败'
  }
}
</script>
