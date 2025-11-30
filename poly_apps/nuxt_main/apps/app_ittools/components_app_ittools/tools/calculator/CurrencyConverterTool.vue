<template>
  <div class="currency-converter-tool">
    <div class="tool-header">
      <h3>Currency Converter</h3>
      <p class="tool-description">Convert between currencies with live exchange rates</p>
    </div>

    <div class="converter-section">
      <div class="amount-input">
        <label>Amount</label>
        <input 
          type="number" 
          v-model.number="amount" 
          class="amount-field"
          min="0"
          step="0.01"
        />
      </div>

      <div class="currency-row">
        <div class="currency-select">
          <label>From</label>
          <select v-model="fromCurrency" class="select-field">
            <option v-for="curr in currencies" :key="curr.code" :value="curr.code">
              {{ curr.flag }} {{ curr.code }} - {{ curr.name }}
            </option>
          </select>
        </div>

        <button @click="swapCurrencies" class="swap-btn">swap_horiz</button>

        <div class="currency-select">
          <label>To</label>
          <select v-model="toCurrency" class="select-field">
            <option v-for="curr in currencies" :key="curr.code" :value="curr.code">
              {{ curr.flag }} {{ curr.code }} - {{ curr.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="result-display">
        <div class="result-value">
          <span class="amount">{{ formatAmount(amount) }}</span>
          <span class="code">{{ fromCurrency }}</span>
        </div>
        <span class="equals">=</span>
        <div class="result-value highlight">
          <span class="amount">{{ formatAmount(convertedAmount) }}</span>
          <span class="code">{{ toCurrency }}</span>
        </div>
      </div>

      <div class="rate-info">
        <span>1 {{ fromCurrency }} = {{ exchangeRate.toFixed(6) }} {{ toCurrency }}</span>
        <span class="update-time">Last updated: {{ lastUpdate }}</span>
      </div>
    </div>

    <div class="quick-convert">
      <h4>Quick Convert</h4>
      <div class="quick-grid">
        <div v-for="amt in quickAmounts" :key="amt" class="quick-item" @click="amount = amt">
          <span class="quick-from">{{ amt }} {{ fromCurrency }}</span>
          <span class="quick-to">{{ formatAmount(amt * exchangeRate) }} {{ toCurrency }}</span>
        </div>
      </div>
    </div>

    <div class="popular-rates">
      <h4>Popular Exchange Rates</h4>
      <div class="rates-grid">
        <div v-for="rate in popularRates" :key="rate.pair" class="rate-card">
          <div class="rate-pair">{{ rate.pair }}</div>
          <div class="rate-value">{{ rate.value.toFixed(4) }}</div>
        </div>
      </div>
    </div>

    <div class="disclaimer">
      <span class="info-icon">info</span>
      <p>Exchange rates are for informational purposes only. Actual rates may vary.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const amount = ref(100);
const fromCurrency = ref('USD');
const toCurrency = ref('EUR');
const rates = ref<Record<string, number>>({});
const lastUpdate = ref('');
const isLoading = ref(false);

const currencies = [
  { code: 'USD', name: 'US Dollar', flag: 'US' },
  { code: 'EUR', name: 'Euro', flag: 'EU' },
  { code: 'GBP', name: 'British Pound', flag: 'GB' },
  { code: 'JPY', name: 'Japanese Yen', flag: 'JP' },
  { code: 'CNY', name: 'Chinese Yuan', flag: 'CN' },
  { code: 'AUD', name: 'Australian Dollar', flag: 'AU' },
  { code: 'CAD', name: 'Canadian Dollar', flag: 'CA' },
  { code: 'CHF', name: 'Swiss Franc', flag: 'CH' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: 'HK' },
  { code: 'SGD', name: 'Singapore Dollar', flag: 'SG' },
  { code: 'INR', name: 'Indian Rupee', flag: 'IN' },
  { code: 'KRW', name: 'South Korean Won', flag: 'KR' },
  { code: 'MXN', name: 'Mexican Peso', flag: 'MX' },
  { code: 'BRL', name: 'Brazilian Real', flag: 'BR' },
  { code: 'RUB', name: 'Russian Ruble', flag: 'RU' },
  { code: 'ZAR', name: 'South African Rand', flag: 'ZA' }
];

const quickAmounts = [1, 10, 100, 1000, 10000];

// Mock exchange rates (in real app, fetch from API)
const mockRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CNY: 7.24,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  HKD: 7.82,
  SGD: 1.34,
  INR: 83.12,
  KRW: 1320.50,
  MXN: 17.15,
  BRL: 4.97,
  RUB: 91.50,
  ZAR: 18.70
};

const exchangeRate = computed(() => {
  const fromRate = mockRates[fromCurrency.value] || 1;
  const toRate = mockRates[toCurrency.value] || 1;
  return toRate / fromRate;
});

const convertedAmount = computed(() => {
  return amount.value * exchangeRate.value;
});

const popularRates = computed(() => {
  const pairs = [
    { pair: 'USD/EUR', from: 'USD', to: 'EUR' },
    { pair: 'USD/GBP', from: 'USD', to: 'GBP' },
    { pair: 'USD/JPY', from: 'USD', to: 'JPY' },
    { pair: 'EUR/GBP', from: 'EUR', to: 'GBP' },
    { pair: 'EUR/JPY', from: 'EUR', to: 'JPY' },
    { pair: 'GBP/JPY', from: 'GBP', to: 'JPY' }
  ];

  return pairs.map(p => ({
    pair: p.pair,
    value: mockRates[p.to] / mockRates[p.from]
  }));
});

const formatAmount = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const swapCurrencies = () => {
  const temp = fromCurrency.value;
  fromCurrency.value = toCurrency.value;
  toCurrency.value = temp;
};

const fetchRates = async () => {
  isLoading.value = true;
  try {
    // In real implementation, fetch from API
    // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    // rates.value = (await response.json()).rates;
    
    // Using mock data
    rates.value = mockRates;
    lastUpdate.value = new Date().toLocaleString();
  } catch (err) {
    console.error('Failed to fetch rates:', err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchRates();
});
</script>

<style scoped>
.currency-converter-tool {
  padding: 20px;
}
.converter-section {
  background: #f8fafc;
  padding: 30px;
  border-radius: 16px;
  margin: 24px 0;
}
.amount-input {
  margin-bottom: 24px;
}
.amount-input label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.amount-field {
  width: 100%;
  padding: 16px;
  font-size: 24px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  text-align: center;
}
.currency-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 30px;
}
.currency-select {
  flex: 1;
}
.currency-select label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.select-field {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
}
.swap-btn {
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
}
.result-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 30px;
  background: white;
  border-radius: 12px;
}
.result-value {
  text-align: center;
}
.result-value .amount {
  display: block;
  font-size: 32px;
  font-weight: bold;
}
.result-value .code {
  font-size: 14px;
  color: #64748b;
}
.result-value.highlight .amount {
  color: #667eea;
}
.equals {
  font-size: 24px;
  color: #94a3b8;
}
.rate-info {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 14px;
  color: #64748b;
}
.quick-convert {
  margin: 30px 0;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.quick-item {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.quick-item:hover {
  background: #e2e8f0;
}
.quick-from {
  display: block;
  font-weight: 500;
  color: #334155;
}
.quick-to {
  display: block;
  font-size: 12px;
  color: #667eea;
  margin-top: 4px;
}
.popular-rates {
  margin: 30px 0;
}
.rates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.rate-card {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rate-pair {
  font-weight: 500;
}
.rate-value {
  color: #667eea;
  font-family: monospace;
}
.disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #fef3c7;
  border-radius: 8px;
  margin-top: 24px;
}
.info-icon {
  color: #f59e0b;
}
.disclaimer p {
  margin: 0;
  font-size: 14px;
  color: #92400e;
}
</style>

