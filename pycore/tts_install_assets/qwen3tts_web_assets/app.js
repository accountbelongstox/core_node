const element = (id) => document.getElementById(id);
let audioUrl = '';
let pollMs = 2500;

function payload() {
  return {
    text: element('text').value,
    language: element('language').value,
    speaker: element('speaker').value || null,
    instruct: element('instruct').value || null,
    format: element('format').value,
  };
}

function showMessage(text, isError = false) {
  element('message').textContent = text;
  element('message').className = isError ? 'bad' : 'muted';
}

function setAudio(url, name) {
  if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
  audioUrl = url;
  element('audio').src = url;
  element('download').href = url;
  element('download').download = name;
  element('download').hidden = false;
}

async function synthesize() {
  showMessage('Synthesizing…');
  try {
    const body = payload();
    const response = await fetch('/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error((await response.text()) || response.statusText);
    const blob = await response.blob();
    setAudio(URL.createObjectURL(blob), `qwen3tts.${body.format}`);
    showMessage('Synthesis complete');
  } catch (error) {
    showMessage(String(error), true);
  }
}

async function submit() {
  showMessage('Submitting…');
  try {
    const response = await fetch('/queue/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || response.statusText);
    showMessage(`Queued ${data.job_id}`);
    await refresh();
  } catch (error) {
    showMessage(String(error), true);
  }
}

async function cancel(jobId) {
  await fetch('/queue/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId }),
  });
  await refresh();
}

function addCell(row, value, className = '') {
  const cell = row.insertCell();
  cell.textContent = value ?? '—';
  if (className) cell.className = className;
  return cell;
}

function renderJobs(jobs) {
  const body = element('jobs');
  body.replaceChildren();
  for (const job of jobs) {
    const row = body.insertRow();
    const status = addCell(row, job.status);
    status.className = `pill ${job.status === 'done' ? 'good' : job.status === 'failed' ? 'bad' : ''}`;
    addCell(row, job.job_id);
    addCell(row, job.text_summary, 'summary');
    addCell(row, `${job.language || ''} / ${job.speaker || 'auto'}`);
    addCell(row, job.submitted_at ? new Date(job.submitted_at).toLocaleTimeString() : '—');
    addCell(row, job.elapsed_ms == null ? '—' : `${job.elapsed_ms} ms`);
    const action = row.insertCell();
    if (job.status === 'done' && job.result_url) {
      const link = document.createElement('a');
      link.href = job.result_url;
      link.textContent = 'Play / download';
      link.onclick = (event) => {
        event.preventDefault();
        setAudio(job.result_url, `qwen3tts-${job.job_id}.${job.format}`);
      };
      action.append(link);
    } else if (job.status === 'pending' || job.status === 'running') {
      const button = document.createElement('button');
      button.textContent = 'Cancel';
      button.className = 'danger';
      button.onclick = () => cancel(job.job_id);
      action.append(button);
    } else {
      action.textContent = job.error || '—';
    }
  }
}

async function refresh() {
  try {
    const statusResponse = await fetch('/status');
    if (!statusResponse.ok) throw new Error('Status request failed');
    const status = await statusResponse.json();
    const gpu = status.gpu || {};
    element('model').textContent = status.model_loaded ? 'loaded' : 'idle';
    element('device').textContent = `${status.device || '—'} / ${status.dtype || '—'}`;
    element('gpu').textContent = gpu.available
      ? `${Math.round(gpu.util_percent || 0)}% / ${gpu.mem_used_mb} MB`
      : 'n/a';
    element('parallel').textContent = String(status.max_parallel || 1);
    element('stats').textContent = `${status.synthesized_count || 0} synthesized · ${status.average_elapsed_ms || 0} ms average`;
    element('counts').textContent = Object.entries(status.counts || {})
      .map(([key, value]) => `${key} ${value}`)
      .join(' · ');
    renderJobs(status.jobs || []);
    pollMs = (status.counts?.running || 0) > 0 ? 5000 : 2500;
  } catch (error) {
    pollMs = Math.min(10000, pollMs * 1.5);
    showMessage(String(error), true);
  }
}

async function loadCapabilities() {
  try {
    const response = await fetch('/capabilities');
    const data = await response.json();
    for (const name of data.speakers || []) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      element('speaker').append(option);
    }
  } catch {
    // The runtime status poll reports service availability separately.
  }
}

async function poll() {
  await refresh();
  window.setTimeout(poll, pollMs);
}

element('direct').onclick = synthesize;
element('submit').onclick = submit;
element('refresh').onclick = refresh;
loadCapabilities();
poll();
