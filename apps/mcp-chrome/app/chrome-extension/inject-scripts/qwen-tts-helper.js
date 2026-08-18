/**
 * Qwen3-TTS Gradio Helper
 *
 * Drives the HuggingFace Qwen3-TTS demo (Gradio 5) inside the page:
 * select a tab, fill inputs, click generate, wait for audio, return bytes.
 *
 * Actions:
 *   - chrome_qwen_tts_ping -> {status:'pong'}
 *   - qwenTtsGenerate {mode,text,voiceDescription,styleInstruction,waitTimeoutMs}
 *   - qwenTtsPeekStatus -> {statusText, hasAudio, generating}
 */

(() => {
  const GRADIO_HOST = 'qwen-qwen3-tts.hf.space';
  if (!location.hostname.includes(GRADIO_HOST)) {
    return;
  }
  if (window.__qwenTtsHelperLoaded) {
    return;
  }
  window.__qwenTtsHelperLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  function tabLabel(mode) {
    if (mode === 'voice_clone') return 'Voice Clone (Base)';
    if (mode === 'custom_voice') return 'TTS (CustomVoice)';
    return 'Voice Design';
  }

  function generateLabel(mode) {
    if (mode === 'voice_clone') return 'Clone & Generate';
    if (mode === 'custom_voice') return 'Generate Speech';
    return 'Generate with Custom Voice';
  }

  function buttonsByText(text) {
    return Array.from(document.querySelectorAll('button')).filter(
      (b) => (b.textContent || '').trim() === text,
    );
  }

  function findTabButton(mode) {
    const label = tabLabel(mode);
    const hits = buttonsByText(label);
    return hits.find((b) => b.getAttribute('role') === 'tab') || hits[0] || null;
  }

  function findGenerateButton(mode) {
    const label = generateLabel(mode);
    const hits = buttonsByText(label);
    return hits[hits.length - 1] || null;
  }

  function findTextarea(match) {
    const areas = Array.from(document.querySelectorAll('textarea'));
    return (
      areas.find((t) => (t.placeholder || '').toLowerCase().includes(match)) ||
      areas.find((t) => {
        const block = t.closest('.block');
        const lbl = block && block.querySelector('label');
        return lbl && (lbl.textContent || '').toLowerCase().includes(match);
      }) ||
      null
    );
  }

  function findStatusTextarea() {
    const areas = Array.from(document.querySelectorAll('textarea'));
    return (
      areas.find((t) => t.disabled || t.readOnly) ||
      areas.find((t) => {
        const block = t.closest('.block');
        const lbl = block && block.querySelector('label');
        return lbl && /status/i.test(lbl.textContent || '');
      }) ||
      null
    );
  }

  function visibleTabPanel() {
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"], .tabitem'));
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return p;
    }
    return panels[0] || document.body;
  }

  function findAudioSrc(root) {
    const scope = root || document;
    const audios = Array.from(scope.querySelectorAll('audio'));
    for (const a of audios) {
      if (a.src && a.src.length > 4 && !a.src.startsWith('data:')) return a.src;
      const source = a.querySelector('source[src]');
      if (source && source.src) return source.src;
    }
    const fileLinks = Array.from(
      scope.querySelectorAll('a[download], a[href*="/file="], a[href*="gradio_api/file"]'),
    );
    for (const a of fileLinks) {
      if (a.href) return a.href;
    }
    const blocks = Array.from(scope.querySelectorAll('.block, [id^="component-"]'));
    for (const block of blocks) {
      const label = block.querySelector('label, .label-wrap');
      if (!label || !/generated audio/i.test(label.textContent || '')) continue;
      const link = block.querySelector('a[href]');
      if (link && link.href) return link.href;
      const audio = block.querySelector('audio[src], audio source[src]');
      if (audio) {
        const src = audio.src || audio.getAttribute('src');
        if (src) return src;
      }
    }
    return '';
  }

  function setTextareaValue(el, text) {
    if (!el) return false;
    el.focus();
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function humanSetText(el, text) {
    if (!el) return false;
    const W = getWebOps();
    if (W && typeof W.humanType === 'function') {
      el.focus();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await W.humanType(el, text);
      return true;
    }
    return setTextareaValue(el, text);
  }

  async function clickButton(btn) {
    if (!btn) return false;
    const W = getWebOps();
    if (W && typeof W.humanClick === 'function') {
      await W.humanClick(btn);
      return true;
    }
    btn.click();
    return true;
  }

  function isGenerating(btn) {
    if (!btn) return false;
    return btn.disabled === true || btn.getAttribute('aria-disabled') === 'true';
  }

  async function waitForGeneration(btn, panel, timeoutMs) {
    const started = Date.now();
    let lastStatus = '';
    let stableStatus = 0;
    let sawGenerating = false;

    while (Date.now() - started < timeoutMs) {
      const statusEl = findStatusTextarea();
      const statusText = statusEl ? (statusEl.value || statusEl.textContent || '').trim() : '';
      const src = findAudioSrc(panel);
      const generating = isGenerating(btn);

      if (generating) sawGenerating = true;

      if (src && (!generating || sawGenerating)) {
        return { ok: true, statusText, src, generating: false };
      }

      if (/error|fail|timeout|queue/i.test(statusText)) {
        return { ok: false, statusText, src: '', generating, error: statusText };
      }

      if (statusText && statusText === lastStatus) {
        stableStatus += 1;
      } else {
        stableStatus = 0;
        lastStatus = statusText;
      }

      if (sawGenerating && !generating && src) {
        return { ok: true, statusText, src, generating: false };
      }

      if (sawGenerating && !generating && stableStatus >= 3 && /done|complete|success|generated/i.test(statusText)) {
        const retrySrc = findAudioSrc(panel);
        if (retrySrc) return { ok: true, statusText, src: retrySrc, generating: false };
      }

      await sleep(1200);
    }

    const finalSrc = findAudioSrc(panel);
    if (finalSrc) {
      return { ok: true, statusText: lastStatus, src: finalSrc, generating: false };
    }
    return {
      ok: false,
      statusText: lastStatus,
      src: '',
      generating: isGenerating(btn),
      error: 'Timed out waiting for Qwen TTS audio',
    };
  }

  async function fetchAudioBytes(src) {
    const W = getWebOps();
    if (W && typeof W.fetchBytes === 'function') {
      const r = await W.fetchBytes(src);
      if (r.ok) return { ok: true, mime: r.mime || 'audio/wav', bytes: r.bytes };
      return { ok: false, error: r.error || 'audio fetch failed' };
    }
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      const buf = await resp.arrayBuffer();
      const mime = resp.headers.get('content-type') || 'audio/wav';
      return { ok: true, mime, bytes: Array.from(new Uint8Array(buf)) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  async function generate(params) {
    const mode = params.mode || 'voice_design';
    const text = String(params.text || '').trim();
    const voiceDescription = String(params.voiceDescription || '').trim();
    const styleInstruction = String(params.styleInstruction || '').trim();
    const waitTimeoutMs = Math.max(15000, Number(params.waitTimeoutMs) || 180000);

    if (!text) {
      return { ok: false, error: 'text is required' };
    }

    const tabBtn = findTabButton(mode);
    if (!tabBtn) {
      return { ok: false, error: `Tab button not found: ${tabLabel(mode)}` };
    }
    await clickButton(tabBtn);
    await sleep(600);

    const panel = visibleTabPanel();
    let textArea = null;
    if (mode === 'voice_clone') {
      textArea = findTextarea('cloned voice') || findTextarea('target text');
    } else {
      textArea = findTextarea('convert to speech') || findTextarea('text to synthesize');
    }
    if (!textArea) {
      return { ok: false, error: 'Text input not found on Qwen TTS page' };
    }

    await humanSetText(textArea, text);
    await sleep(300);

    if (mode === 'voice_design' && voiceDescription) {
      const voiceArea =
        findTextarea('voice characteristics') || findTextarea('describe the voice');
      if (voiceArea) {
        await humanSetText(voiceArea, voiceDescription);
        await sleep(250);
      }
    }

    if (mode === 'custom_voice' && styleInstruction) {
      const styleArea = findTextarea('cheerful') || findTextarea('style');
      if (styleArea) {
        await humanSetText(styleArea, styleInstruction);
        await sleep(250);
      }
    }

    const genBtn = findGenerateButton(mode);
    if (!genBtn) {
      return { ok: false, error: `Generate button not found: ${generateLabel(mode)}` };
    }

    const beforeSrc = findAudioSrc(panel);
    await clickButton(genBtn);
    await sleep(800);

    const waited = await waitForGeneration(genBtn, panel, waitTimeoutMs);
    if (!waited.ok) {
      return {
        ok: false,
        error: waited.error || waited.statusText || 'Generation failed',
        statusText: waited.statusText,
      };
    }

    let src = waited.src || findAudioSrc(panel);
    if (!src || src === beforeSrc) {
      await sleep(1500);
      src = findAudioSrc(panel);
    }
    if (!src) {
      return { ok: false, error: 'Audio element appeared but no source URL found', statusText: waited.statusText };
    }

    const audio = await fetchAudioBytes(src);
    if (!audio.ok) {
      return { ok: false, error: audio.error || 'Failed to download audio bytes', src, statusText: waited.statusText };
    }

    return {
      ok: true,
      mime: audio.mime,
      bytes: audio.bytes,
      src,
      statusText: waited.statusText,
      mode,
      text,
    };
  }

  function peekStatus() {
    const panel = visibleTabPanel();
    const genBtn = findGenerateButton('voice_design') || findGenerateButton('custom_voice');
    return {
      statusText: (findStatusTextarea()?.value || '').trim(),
      hasAudio: !!findAudioSrc(panel),
      generating: isGenerating(genBtn),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'chrome_qwen_tts_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'qwenTtsGenerate') {
      generate(message)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
      return true;
    }
    if (message.action === 'qwenTtsPeekStatus') {
      sendResponse(peekStatus());
      return true;
    }
    return false;
  });
})();
