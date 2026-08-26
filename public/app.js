const form = document.querySelector('#download-form');
const input = document.querySelector('#url');
const button = form.querySelector('button');
const clearButton = document.querySelector('#clear-button');
const statusBox = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const percent = document.querySelector('#percent');
const progressBar = document.querySelector('#progress-bar');
const fileLink = document.querySelector('#file-link');
const errorBox = document.querySelector('#error');
const activityLog = document.querySelector('#activity-log');
const logCount = document.querySelector('#log-count');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  clearButton.disabled = true;
  errorBox.hidden = true;
  fileLink.hidden = true;
  activityLog.replaceChildren();
  logCount.textContent = '0';
  statusBox.hidden = false;
  updateProgress('Preparando descarga…', 0);

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.value.trim() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar la descarga.');
    await trackJob(data.id);
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    clearButton.disabled = false;
  }
});

clearButton.addEventListener('click', () => {
  form.reset();
  statusBox.hidden = true;
  errorBox.hidden = true;
  fileLink.hidden = true;
  activityLog.replaceChildren();
  logCount.textContent = '0';
  updateProgress('Preparando…', 0);
  input.focus();
});

async function trackJob(id) {
  while (true) {
    const response = await fetch(`/api/status/${id}`);
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || 'No se pudo consultar el progreso.');
    updateProgress(job.message, job.progress);
    renderLogs(job.logs || []);
    if (job.status === 'error') throw new Error(job.error);
    if (job.status === 'done') {
      fileLink.href = `/api/file/${id}`;
      fileLink.hidden = false;
      return;
    }
    await wait(750);
  }
}

function renderLogs(logs) {
  const shouldFollow = activityLog.scrollHeight - activityLog.scrollTop - activityLog.clientHeight < 40;
  const fragment = document.createDocumentFragment();
  for (const entry of logs) {
    const row = document.createElement('div');
    row.className = `log-entry log-${entry.level}`;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = new Date(entry.time).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const message = document.createElement('span');
    message.className = 'log-message';
    message.textContent = entry.message;
    row.append(time, message);
    fragment.append(row);
  }
  activityLog.replaceChildren(fragment);
  logCount.textContent = String(logs.length);
  if (shouldFollow) activityLog.scrollTop = activityLog.scrollHeight;
}

function updateProgress(message, value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  statusText.textContent = message;
  percent.textContent = `${Math.round(safeValue)}%`;
  progressBar.style.width = `${safeValue}%`;
}

function showError(message) {
  const hasActivity = activityLog.childElementCount > 0;
  statusBox.hidden = !hasActivity;
  if (hasActivity) statusText.textContent = 'La descarga no pudo completarse';
  errorBox.textContent = message;
  errorBox.hidden = false;
}
