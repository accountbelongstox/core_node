import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/config/api'

export const useAccountsStore = defineStore('accounts', () => {
  // 状态
  const claudeAccounts = ref([])
  const claudeConsoleAccounts = ref([])
  const bedrockAccounts = ref([])
  const geminiAccounts = ref([])
  const geminiApiAccounts = ref([])
  const openaiAccounts = ref([])
  const azureOpenaiAccounts = ref([])
  const openaiResponsesAccounts = ref([])
  const ccrAccounts = ref([])
  const droidAccounts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const sortBy = ref('')
  const sortOrder = ref('asc')
  const fromClient = ref(false)
  const clientId = ref('')

  // Actions

  // 获取Claude账户列表
  const fetchClaudeAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts`
        : '/admin/claude-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        claudeAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Claude账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Claude Console账户列表
  const fetchClaudeConsoleAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-console-accounts`
        : '/admin/claude-console-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        claudeConsoleAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Claude Console账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Bedrock账户列表
  const fetchBedrockAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/bedrock-accounts`
        : '/admin/bedrock-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        bedrockAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Bedrock账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Gemini账户列表
  const fetchGeminiAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-accounts`
        : '/admin/gemini-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        geminiAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Gemini账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Gemini API账户列表
  const fetchGeminiApiAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-api-accounts`
        : '/admin/gemini-api-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        geminiApiAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Gemini API账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取OpenAI账户列表
  const fetchOpenAIAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-accounts`
        : '/admin/openai-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        openaiAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Azure OpenAI账户列表
  const fetchAzureOpenAIAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/azure-openai-accounts`
        : '/admin/azure-openai-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        azureOpenaiAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Azure OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取OpenAI-Responses账户列表
  const fetchOpenAIResponsesAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-responses-accounts`
        : '/admin/openai-responses-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        openaiResponsesAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取OpenAI-Responses账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取CCR账户列表
  const fetchCcrAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/ccr-accounts`
        : '/admin/ccr-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        ccrAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取CCR账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取Droid账户列表
  const fetchDroidAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/droid-accounts`
        : '/admin/droid-accounts'
      const response = await apiClient.get(url)
      if (response.success) {
        droidAccounts.value = response.data || []
      } else {
        throw new Error(response.message || '获取Droid账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取所有账户
  const fetchAllAccounts = async () => {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchClaudeAccounts(),
        fetchClaudeConsoleAccounts(),
        fetchBedrockAccounts(),
        fetchGeminiAccounts(),
        fetchGeminiApiAccounts(),
        fetchOpenAIAccounts(),
        fetchAzureOpenAIAccounts(),
        fetchOpenAIResponsesAccounts(),
        fetchCcrAccounts(),
        fetchDroidAccounts()
      ])
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Claude账户
  const createClaudeAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts`
        : '/admin/claude-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchClaudeAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Claude账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Claude Console账户
  const createClaudeConsoleAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-console-accounts`
        : '/admin/claude-console-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchClaudeConsoleAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Claude Console账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Bedrock账户
  const createBedrockAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/bedrock-accounts`
        : '/admin/bedrock-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchBedrockAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Bedrock账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Gemini账户
  const createGeminiAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-accounts`
        : '/admin/gemini-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchGeminiAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Gemini账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建OpenAI账户
  const createOpenAIAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-accounts`
        : '/admin/openai-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchOpenAIAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Droid账户
  const createDroidAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/droid-accounts`
        : '/admin/droid-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchDroidAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Droid账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Droid账户
  const updateDroidAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/droid-accounts/${id}`
        : `/admin/droid-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchDroidAccounts()
        return response.data
      } else {
        throw new Error(response.message || '更新Droid账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Azure OpenAI账户
  const createAzureOpenAIAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/azure-openai-accounts`
        : '/admin/azure-openai-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchAzureOpenAIAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Azure OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建OpenAI-Responses账户
  const createOpenAIResponsesAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-responses-accounts`
        : '/admin/openai-responses-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchOpenAIResponsesAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建OpenAI-Responses账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建Gemini API账户
  const createGeminiApiAccount = async (data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-api-accounts`
        : '/admin/gemini-api-accounts'
      const response = await apiClient.post(url, data)
      if (response.success) {
        await fetchGeminiApiAccounts()
        return response.data
      } else {
        throw new Error(response.message || '创建Gemini API账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Claude账户
  const updateClaudeAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/${id}`
        : `/admin/claude-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchClaudeAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Claude账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Claude Console账户
  const updateClaudeConsoleAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-console-accounts/${id}`
        : `/admin/claude-console-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchClaudeConsoleAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Claude Console账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Bedrock账户
  const updateBedrockAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/bedrock-accounts/${id}`
        : `/admin/bedrock-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchBedrockAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Bedrock账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Gemini账户
  const updateGeminiAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-accounts/${id}`
        : `/admin/gemini-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchGeminiAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Gemini账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新OpenAI账户
  const updateOpenAIAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-accounts/${id}`
        : `/admin/openai-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchOpenAIAccounts()
        return response
      } else {
        throw new Error(response.message || '更新OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Azure OpenAI账户
  const updateAzureOpenAIAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/azure-openai-accounts/${id}`
        : `/admin/azure-openai-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchAzureOpenAIAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Azure OpenAI账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新OpenAI-Responses账户
  const updateOpenAIResponsesAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-responses-accounts/${id}`
        : `/admin/openai-responses-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchOpenAIResponsesAccounts()
        return response
      } else {
        throw new Error(response.message || '更新OpenAI-Responses账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新Gemini API账户
  const updateGeminiApiAccount = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-api-accounts/${id}`
        : `/admin/gemini-api-accounts/${id}`
      const response = await apiClient.put(url, data)
      if (response.success) {
        await fetchGeminiApiAccounts()
        return response
      } else {
        throw new Error(response.message || '更新Gemini API账户失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 切换账户状态
  const toggleAccount = async (platform, id) => {
    loading.value = true
    error.value = null
    try {
      const baseUrl = fromClient.value ? `/admin/clients/${clientId.value}` : '/admin'
      let endpoint
      if (platform === 'claude') {
        endpoint = `${baseUrl}/claude-accounts/${id}/toggle`
      } else if (platform === 'claude-console') {
        endpoint = `${baseUrl}/claude-console-accounts/${id}/toggle`
      } else if (platform === 'bedrock') {
        endpoint = `${baseUrl}/bedrock-accounts/${id}/toggle`
      } else if (platform === 'gemini') {
        endpoint = `${baseUrl}/gemini-accounts/${id}/toggle`
      } else if (platform === 'openai') {
        endpoint = `${baseUrl}/openai-accounts/${id}/toggle`
      } else if (platform === 'azure_openai') {
        endpoint = `${baseUrl}/azure-openai-accounts/${id}/toggle`
      } else if (platform === 'openai-responses') {
        endpoint = `${baseUrl}/openai-responses-accounts/${id}/toggle`
      } else if (platform === 'droid') {
        endpoint = `${baseUrl}/droid-accounts/${id}/toggle`
      } else {
        endpoint = `${baseUrl}/openai-accounts/${id}/toggle`
      }

      const response = await apiClient.put(endpoint)
      if (response.success) {
        if (platform === 'claude') {
          await fetchClaudeAccounts()
        } else if (platform === 'claude-console') {
          await fetchClaudeConsoleAccounts()
        } else if (platform === 'bedrock') {
          await fetchBedrockAccounts()
        } else if (platform === 'gemini') {
          await fetchGeminiAccounts()
        } else if (platform === 'openai') {
          await fetchOpenAIAccounts()
        } else if (platform === 'azure_openai') {
          await fetchAzureOpenAIAccounts()
        } else if (platform === 'openai-responses') {
          await fetchOpenAIResponsesAccounts()
        } else if (platform === 'droid') {
          await fetchDroidAccounts()
        } else {
          await fetchOpenAIAccounts()
        }
        return response
      } else {
        throw new Error(response.message || '切换状态失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除账户
  const deleteAccount = async (platform, id) => {
    loading.value = true
    error.value = null
    try {
      const baseUrl = fromClient.value ? `/admin/clients/${clientId.value}` : '/admin'
      let endpoint
      if (platform === 'claude') {
        endpoint = `${baseUrl}/claude-accounts/${id}`
      } else if (platform === 'claude-console') {
        endpoint = `${baseUrl}/claude-console-accounts/${id}`
      } else if (platform === 'bedrock') {
        endpoint = `${baseUrl}/bedrock-accounts/${id}`
      } else if (platform === 'gemini') {
        endpoint = `${baseUrl}/gemini-accounts/${id}`
      } else if (platform === 'openai') {
        endpoint = `${baseUrl}/openai-accounts/${id}`
      } else if (platform === 'azure_openai') {
        endpoint = `${baseUrl}/azure-openai-accounts/${id}`
      } else if (platform === 'openai-responses') {
        endpoint = `${baseUrl}/openai-responses-accounts/${id}`
      } else if (platform === 'droid') {
        endpoint = `${baseUrl}/droid-accounts/${id}`
      } else {
        endpoint = `${baseUrl}/openai-accounts/${id}`
      }

      const response = await apiClient.delete(endpoint)
      if (response.success) {
        if (platform === 'claude') {
          await fetchClaudeAccounts()
        } else if (platform === 'claude-console') {
          await fetchClaudeConsoleAccounts()
        } else if (platform === 'bedrock') {
          await fetchBedrockAccounts()
        } else if (platform === 'gemini') {
          await fetchGeminiAccounts()
        } else if (platform === 'openai') {
          await fetchOpenAIAccounts()
        } else if (platform === 'azure_openai') {
          await fetchAzureOpenAIAccounts()
        } else if (platform === 'openai-responses') {
          await fetchOpenAIResponsesAccounts()
        } else if (platform === 'droid') {
          await fetchDroidAccounts()
        } else {
          await fetchOpenAIAccounts()
        }
        return response
      } else {
        throw new Error(response.message || '删除失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 刷新Claude Token
  const refreshClaudeToken = async (id) => {
    loading.value = true
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/${id}/refresh`
        : `/admin/claude-accounts/${id}/refresh`
      const response = await apiClient.post(url)
      if (response.success) {
        await fetchClaudeAccounts()
        return response
      } else {
        throw new Error(response.message || 'Token刷新失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 生成Claude OAuth URL
  const generateClaudeAuthUrl = async (proxyConfig) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/generate-auth-url`
        : '/admin/claude-accounts/generate-auth-url'
      const response = await apiClient.post(url, proxyConfig)
      if (response.success) {
        return response.data // 返回整个对象，包含authUrl和sessionId
      } else {
        throw new Error(response.message || '生成授权URL失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 交换Claude OAuth Code
  const exchangeClaudeCode = async (data) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/exchange-code`
        : '/admin/claude-accounts/exchange-code'
      const response = await apiClient.post(url, data)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || '交换授权码失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 生成Claude Setup Token URL
  const generateClaudeSetupTokenUrl = async (proxyConfig) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/generate-setup-token-url`
        : '/admin/claude-accounts/generate-setup-token-url'
      const response = await apiClient.post(url, proxyConfig)
      if (response.success) {
        return response.data // 返回整个对象，包含authUrl和sessionId
      } else {
        throw new Error(response.message || '生成Setup Token URL失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 交换Claude Setup Token Code
  const exchangeClaudeSetupTokenCode = async (data) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/exchange-setup-token-code`
        : '/admin/claude-accounts/exchange-setup-token-code'
      const response = await apiClient.post(url, data)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || '交换Setup Token授权码失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // Cookie自动授权 - 普通OAuth
  const oauthWithCookie = async (payload) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/oauth-with-cookie`
        : '/admin/claude-accounts/oauth-with-cookie'
      const response = await apiClient.post(url, payload)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || 'Cookie授权失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // Cookie自动授权 - Setup Token
  const oauthSetupTokenWithCookie = async (payload) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/claude-accounts/setup-token-with-cookie`
        : '/admin/claude-accounts/setup-token-with-cookie'
      const response = await apiClient.post(url, payload)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || 'Cookie授权失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 生成Gemini OAuth URL
  const generateGeminiAuthUrl = async (proxyConfig) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-accounts/generate-auth-url`
        : '/admin/gemini-accounts/generate-auth-url'
      const response = await apiClient.post(url, proxyConfig)
      if (response.success) {
        return response.data // 返回整个对象，包含authUrl和sessionId
      } else {
        throw new Error(response.message || '生成授权URL失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 交换Gemini OAuth Code
  const exchangeGeminiCode = async (data) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/gemini-accounts/exchange-code`
        : '/admin/gemini-accounts/exchange-code'
      const response = await apiClient.post(url, data)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || '交换授权码失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 生成OpenAI OAuth URL
  const generateOpenAIAuthUrl = async (proxyConfig) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-accounts/generate-auth-url`
        : '/admin/openai-accounts/generate-auth-url'
      const response = await apiClient.post(url, proxyConfig)
      if (response.success) {
        return response.data // 返回整个对象，包含authUrl和sessionId
      } else {
        throw new Error(response.message || '生成授权URL失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 生成Droid OAuth URL
  const generateDroidAuthUrl = async (proxyConfig) => {
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/droid-accounts/generate-auth-url`
        : '/admin/droid-accounts/generate-auth-url'
      const response = await apiClient.post(url, proxyConfig)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || '生成授权URL失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 交换OpenAI OAuth Code
  const exchangeOpenAICode = async (data) => {
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/openai-accounts/exchange-code`
        : '/admin/openai-accounts/exchange-code'
      const response = await apiClient.post(url, data)
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.message || '交换授权码失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 交换Droid OAuth Code
  const exchangeDroidCode = async (data) => {
    error.value = null
    try {
      const url = fromClient.value
        ? `/admin/clients/${clientId.value}/droid-accounts/exchange-code`
        : '/admin/droid-accounts/exchange-code'
      const response = await apiClient.post(url, data)
      return response
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 排序账户
  const sortAccounts = (field) => {
    if (sortBy.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = field
      sortOrder.value = 'asc'
    }
  }

  // 重置store
  const reset = () => {
    claudeAccounts.value = []
    claudeConsoleAccounts.value = []
    bedrockAccounts.value = []
    geminiAccounts.value = []
    geminiApiAccounts.value = []
    openaiAccounts.value = []
    azureOpenaiAccounts.value = []
    openaiResponsesAccounts.value = []
    ccrAccounts.value = []
    droidAccounts.value = []
    loading.value = false
    error.value = null
    sortBy.value = ''
    sortOrder.value = 'asc'
  }

  return {
    // State
    claudeAccounts,
    claudeConsoleAccounts,
    bedrockAccounts,
    geminiAccounts,
    geminiApiAccounts,
    openaiAccounts,
    azureOpenaiAccounts,
    openaiResponsesAccounts,
    ccrAccounts,
    droidAccounts,
    loading,
    error,
    sortBy,
    sortOrder,
    fromClient,
    clientId,

    // Actions
    fetchClaudeAccounts,
    fetchClaudeConsoleAccounts,
    fetchBedrockAccounts,
    fetchGeminiAccounts,
    fetchGeminiApiAccounts,
    fetchOpenAIAccounts,
    fetchAzureOpenAIAccounts,
    fetchOpenAIResponsesAccounts,
    fetchCcrAccounts,
    fetchDroidAccounts,
    fetchAllAccounts,
    createClaudeAccount,
    createClaudeConsoleAccount,
    createBedrockAccount,
    createGeminiAccount,
    createOpenAIAccount,
    createDroidAccount,
    updateDroidAccount,
    createAzureOpenAIAccount,
    createOpenAIResponsesAccount,
    createGeminiApiAccount,
    updateClaudeAccount,
    updateClaudeConsoleAccount,
    updateBedrockAccount,
    updateGeminiAccount,
    updateOpenAIAccount,
    updateAzureOpenAIAccount,
    updateOpenAIResponsesAccount,
    updateGeminiApiAccount,
    toggleAccount,
    deleteAccount,
    refreshClaudeToken,
    generateClaudeAuthUrl,
    exchangeClaudeCode,
    generateClaudeSetupTokenUrl,
    exchangeClaudeSetupTokenCode,
    oauthWithCookie,
    oauthSetupTokenWithCookie,
    generateGeminiAuthUrl,
    exchangeGeminiCode,
    generateOpenAIAuthUrl,
    exchangeOpenAICode,
    generateDroidAuthUrl,
    exchangeDroidCode,
    sortAccounts,
    reset
  }
})
