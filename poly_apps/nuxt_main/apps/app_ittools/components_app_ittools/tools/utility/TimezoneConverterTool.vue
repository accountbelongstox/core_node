<template>
  <div class="timezone-converter-tool">
    <div class="tool-header">
      <h3>Time Zone Converter</h3>
      <p class="tool-description">Convert time between different time zones</p>
    </div>

    <div class="converter-section">
      <div class="time-input-group">
        <label>Date & Time</label>
        <input type="datetime-local" v-model="inputDateTime" class="input-field" />
      </div>

      <div class="timezone-selectors">
        <div class="timezone-group">
          <label>From Time Zone</label>
          <select v-model="fromTimezone" class="select-field">
            <option v-for="tz in commonTimezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
        </div>
        <button @click="swapTimezones" class="swap-btn">Swap</button>
        <div class="timezone-group">
          <label>To Time Zone</label>
          <select v-model="toTimezone" class="select-field">
            <option v-for="tz in commonTimezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="result-section">
      <div class="result-card">
        <div class="result-label">{{ fromTimezone }}</div>
        <div class="result-time">{{ formattedFromTime }}</div>
        <div class="result-date">{{ formattedFromDate }}</div>
      </div>
      <div class="arrow">arrow_forward</div>
      <div class="result-card highlight">
        <div class="result-label">{{ toTimezone }}</div>
        <div class="result-time">{{ formattedToTime }}</div>
        <div class="result-date">{{ formattedToDate }}</div>
      </div>
    </div>

    <div class="difference-info">
      <span>Time Difference: {{ timeDifference }}</span>
    </div>

    <div class="world-clocks">
      <h4>World Clocks</h4>
      <div class="clocks-grid">
        <div v-for="clock in worldClocks" :key="clock.tz" class="clock-card">
          <div class="clock-city">{{ clock.city }}</div>
          <div class="clock-time">{{ clock.time }}</div>
          <div class="clock-date">{{ clock.date }}</div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <button @click="setToNow" class="btn-secondary">Use Current Time</button>
      <button @click="copyResult" class="btn-primary">Copy Result</button>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const inputDateTime = ref('');
const fromTimezone = ref('UTC');
const toTimezone = ref('America/New_York');
const copied = ref(false);
let updateInterval: ReturnType<typeof setInterval> | null = null;

const commonTimezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' }
];

const getDateInTimezone = (date: Date, tz: string): Date => {
  const str = date.toLocaleString('en-US', { timeZone: tz });
  return new Date(str);
};

const formattedFromTime = computed(() => {
  if (!inputDateTime.value) return '--:--';
  const date = new Date(inputDateTime.value);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
});

const formattedFromDate = computed(() => {
  if (!inputDateTime.value) return '---';
  const date = new Date(inputDateTime.value);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
});

const convertedDate = computed(() => {
  if (!inputDateTime.value) return null;
  
  const date = new Date(inputDateTime.value);
  
  // Get offset for from timezone
  const fromStr = date.toLocaleString('en-US', { timeZone: fromTimezone.value });
  const fromDate = new Date(fromStr);
  
  // Get offset for to timezone
  const toStr = date.toLocaleString('en-US', { timeZone: toTimezone.value });
  const toDate = new Date(toStr);
  
  // Calculate the difference and apply
  const diff = toDate.getTime() - fromDate.getTime();
  return new Date(date.getTime() + diff);
});

const formattedToTime = computed(() => {
  if (!convertedDate.value) return '--:--';
  return convertedDate.value.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
});

const formattedToDate = computed(() => {
  if (!convertedDate.value) return '---';
  return convertedDate.value.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
});

const timeDifference = computed(() => {
  if (!inputDateTime.value) return '0 hours';
  
  const date = new Date(inputDateTime.value);
  const fromStr = date.toLocaleString('en-US', { timeZone: fromTimezone.value });
  const toStr = date.toLocaleString('en-US', { timeZone: toTimezone.value });
  
  const diff = new Date(toStr).getTime() - new Date(fromStr).getTime();
  const hours = diff / (1000 * 60 * 60);
  
  if (hours === 0) return 'Same time';
  const sign = hours > 0 ? '+' : '';
  return `${sign}${hours} hours`;
});

const worldClocks = computed(() => {
  const now = new Date();
  const cities = [
    { city: 'New York', tz: 'America/New_York' },
    { city: 'London', tz: 'Europe/London' },
    { city: 'Tokyo', tz: 'Asia/Tokyo' },
    { city: 'Sydney', tz: 'Australia/Sydney' }
  ];
  
  return cities.map(c => ({
    ...c,
    time: now.toLocaleTimeString('en-US', { 
      timeZone: c.tz,
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }),
    date: now.toLocaleDateString('en-US', {
      timeZone: c.tz,
      month: 'short',
      day: 'numeric'
    })
  }));
});

const setToNow = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  inputDateTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
};

const swapTimezones = () => {
  const temp = fromTimezone.value;
  fromTimezone.value = toTimezone.value;
  toTimezone.value = temp;
};

const copyResult = async () => {
  const text = `${formattedFromTime.value} ${fromTimezone.value} = ${formattedToTime.value} ${toTimezone.value}`;
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

onMounted(() => {
  setToNow();
  updateInterval = setInterval(() => {
    // Force reactivity update for world clocks
  }, 60000);
});

onUnmounted(() => {
  if (updateInterval) clearInterval(updateInterval);
});
</script>

<style scoped>
.timezone-converter-tool {
  padding: 20px;
}
.converter-section {
  margin: 20px 0;
}
.time-input-group {
  margin-bottom: 20px;
}
.time-input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.input-field {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 16px;
}
.timezone-selectors {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}
.timezone-group {
  flex: 1;
}
.timezone-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.select-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.swap-btn {
  padding: 10px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.result-section {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 30px 0;
}
.result-card {
  flex: 1;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  text-align: center;
}
.result-card.highlight {
  background: #667eea;
  color: white;
}
.result-label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 8px;
}
.result-time {
  font-size: 32px;
  font-weight: bold;
}
.result-date {
  font-size: 14px;
  margin-top: 8px;
  opacity: 0.8;
}
.arrow {
  font-size: 24px;
  color: #667eea;
}
.difference-info {
  text-align: center;
  color: #64748b;
  margin-bottom: 30px;
}
.world-clocks {
  margin: 30px 0;
}
.clocks-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 12px;
}
.clock-card {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  text-align: center;
}
.clock-city {
  font-weight: 600;
  color: #334155;
}
.clock-time {
  font-size: 20px;
  font-weight: bold;
  color: #667eea;
  margin: 8px 0;
}
.clock-date {
  font-size: 12px;
  color: #64748b;
}
.quick-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.btn-primary, .btn-secondary {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary {
  background: #667eea;
  color: white;
}
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
}
.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #22c55e;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
}
</style>

