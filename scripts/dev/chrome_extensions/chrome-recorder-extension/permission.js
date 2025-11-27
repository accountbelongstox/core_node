async function checkMicrophonePermission() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state;
  } catch (error) {
    return 'unknown';
  }
}

async function updatePermissionStatus() {
  const state = await checkMicrophonePermission();
  const statusEl = document.getElementById('permissionStatus');
  
  switch (state) {
    case 'granted':
      statusEl.textContent = 'Status: Permission GRANTED';
      statusEl.style.color = '#34a853';
      break;
    case 'denied':
      statusEl.textContent = 'Status: Permission DENIED - Please check Chrome and system settings';
      statusEl.style.color = '#ea4335';
      break;
    case 'prompt':
      statusEl.textContent = 'Status: Permission not yet requested';
      statusEl.style.color = '#fbbc04';
      break;
    default:
      statusEl.textContent = 'Status: Unable to check permission';
      statusEl.style.color = '#666';
  }
}

document.getElementById("requestPermission").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Requesting permission...";
  statusEl.style.color = '#666';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());

    statusEl.textContent = "Permission granted! You can close this tab.";
    statusEl.style.color = '#34a853';

    await updatePermissionStatus();

    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error('Permission error:', error);
    
    let errorMsg = "Permission denied. ";
    if (error.name === 'NotAllowedError') {
      errorMsg += "Please check Chrome settings and system microphone permissions.";
    } else if (error.name === 'NotFoundError') {
      errorMsg += "No microphone device found.";
    } else if (error.name === 'NotReadableError') {
      errorMsg += "Microphone is in use by another application.";
    } else {
      errorMsg += error.message;
    }
    
    statusEl.textContent = errorMsg;
    statusEl.style.color = '#ea4335';
    
    await updatePermissionStatus();
  }
});

document.getElementById("openSettings").addEventListener("click", () => {
  chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
});

document.getElementById("checkPermission").addEventListener("click", async () => {
  await updatePermissionStatus();
});

updatePermissionStatus();
