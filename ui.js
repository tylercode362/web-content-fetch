(() => {
  let csrf = document.querySelector('[name="csrf-token"]').content;
  const statusLabels = {
    queued: '排隊中',
    running: '執行中',
    pausing: '暫停中',
    paused: '已暫停',
    cancelling: '取消中',
    complete: '已完成',
    error: '失敗',
    cancelled: '已取消'
  };
  const recoveryDiagnostics = new Set([
    'browser_client_disconnected',
    'browser_client_offline',
    'browser_command_timeout',
    'browser_content_selector_timeout',
    'browser_content_ready_timeout',
    'browser_navigation_timeout',
    'novel_inline_images_missing',
    'bridge_transport_failed',
    'secure_transport_failed'
  ]);
  const browserBase = window.location.pathname.startsWith('/web-content-fetch') ? '/web-content-fetch' : '';
  const pendingActions = new Set();

  const node = (tag, props = {}, children = []) => {
    const value = document.createElement(tag);
    Object.entries(props).forEach(([key, item]) => {
      if (key === 'className') value.className = item;
      else if (key === 'textContent') value.textContent = item;
      else if (key.startsWith('data-') || key.startsWith('aria-')) value.setAttribute(key, item);
      else value[key] = item;
    });
    children.forEach(child => value.append(child));
    return value;
  };

  const prefixed = value => {
    const text = String(value || '');
    return text.startsWith('/') && browserBase && !text.startsWith(browserBase + '/')
      ? browserBase + text
      : text;
  };

  const safeHttpUrl = value => {
    try {
      const parsed = new URL(String(value || ''));
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  };

  const makeUuid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' + hex.slice(20);
  };

  const browserServiceId = (() => {
    const key = 'web-content-fetch.serviceClientId';
    let value = localStorage.getItem(key);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) {
      value = makeUuid();
      localStorage.setItem(key, value);
    }
    return value;
  })();

  document.querySelector('#browserServiceId').textContent = '本瀏覽器 service UUID：' + browserServiceId;

  const setFeedback = (id, message, error = false) => {
    const element = document.querySelector(id);
    element.textContent = message || '';
    element.className = 'feedback' + (error ? ' error-text' : '');
  };

  const statusLabel = status => statusLabels[status] || status || '未知';

  const progressInfo = job => {
    const progress = job.progress || {};
    const validCount = value => Number.isInteger(value) && value >= 0 ? value : null;
    const total = [progress.chapterTotal, progress.total, job.chapterCount]
      .map(validCount)
      .find(value => value !== null) ?? null;
    const reportedCompleted = validCount(progress.completed);
    const completed = total === null
      ? (reportedCompleted ?? 0)
      : Math.min(total, Math.max(0, reportedCompleted ?? (job.status === 'complete' ? total : 0)));
    const bridgeProgress = job.bridgeProgress || {};
    const bridgePhase = String(bridgeProgress.phase || '');
    const hasBridgeAssetProgress = ['assets_verified', 'asset_verified'].includes(bridgePhase) &&
      Number.isInteger(bridgeProgress.completed) && Number.isInteger(bridgeProgress.total);
    const bridgeCompleted = hasBridgeAssetProgress ? Math.max(0, bridgeProgress.completed) : 0;
    let detailLabel = progress.phase || '等待中';
    let chapterDownloadLabel = '等待目前章節';
    let chapterDownloadRatio = 0;
    if (Number.isInteger(progress.image) && Number.isInteger(progress.imageTotal)) {
      const downloadedImages = Math.min(progress.imageTotal, progress.image + bridgeCompleted);
      detailLabel = '目前第 ' + (progress.chapter || '?') + ' 章 · 圖片 ' + downloadedImages + ' / ' + progress.imageTotal;
      chapterDownloadLabel = '第 ' + (progress.chapter || '?') + ' 章 · 圖片 ' + downloadedImages + ' / ' + progress.imageTotal;
      chapterDownloadRatio = progress.imageTotal > 0 ? downloadedImages / progress.imageTotal : 0;
    } else if (Number.isInteger(progress.chapter)) {
      detailLabel = '目前第 ' + progress.chapter + ' 章 · ' + (progress.phase || '處理中');
      if (progress.phase === 'writing_epub') {
        chapterDownloadLabel = '第 ' + progress.chapter + ' 章圖片已完成，正在產生檔案';
        chapterDownloadRatio = 1;
      } else {
        chapterDownloadLabel = '第 ' + progress.chapter + ' 章 · ' + (progress.phase || '處理中');
      }
    } else if (job.status === 'complete' || progress.phase === 'complete') {
      chapterDownloadLabel = '全部章節已完成';
      chapterDownloadRatio = 1;
    }
    return {
      chapterLabel: '章節進度：' + completed + ' / ' + (total === null ? '-' : total) + '（已完成／總章節）',
      detailLabel,
      ratio: total > 0 ? completed / total : 0,
      chapterDownloadLabel,
      chapterDownloadRatio
    };
  };

  const appendDownload = (parent, download) => {
    if (!download?.href) return;
    const format = String(download.format || '檔案');
    const filename = String(download.filename || '下載');
    const link = node('a', {
      className: 'download-link',
      href: prefixed(download.href),
      download: download.filename || '',
      title: filename,
      'aria-label': format + '：' + filename
    });
    link.append(
      node('span', { className: 'download-format', textContent: format }),
      node('span', { className: 'download-filename', textContent: filename })
    );
    parent.append(link);
  };

  const appendActions = (parent, job) => {
    if (pendingActions.has(job.id)) {
      parent.append(node('span', { className: 'action-status', textContent: '操作處理中…' }));
      return;
    }
    const actions = [];
    const add = (action, label, className = 'button ghost') => actions.push(node('button', {
      className,
      type: 'button',
      textContent: label,
      'data-job-id': job.id,
      'data-action': action
    }));
    if (['queued', 'running'].includes(job.status)) add('pause', '暫停');
    if (job.status === 'paused') add('resume', '恢復');
    if (['queued', 'running', 'pausing', 'paused', 'cancelling'].includes(job.status)) {
      add('cancel', '取消並刪除', 'button danger');
    }
    if (['complete', 'error', 'cancelled'].includes(job.status)) {
      add('delete', '清除紀錄與檔案', 'button danger');
    }
    if (job.status === 'error' && recoveryDiagnostics.has(job.diagnostic)) {
      add('resume', '保留進度並恢復', 'button secondary');
    }
    actions.forEach(action => parent.append(action));
  };

  const renderJob = (job, expandedJobIds) => {
    const progress = progressInfo(job);
    const badge = node('span', {
      className: 'badge ' + (job.status || ''),
      textContent: statusLabel(job.status)
    });
    const summary = node('summary', { className: 'job-summary' }, [
      node('span', { className: 'job-summary-main' }, [
        node('strong', { className: 'job-title', textContent: job.title || job.url || '未命名工作' }),
        node('span', { className: 'job-summary-url', textContent: job.url || '無網址' })
      ]),
      badge
    ]);
    const target = node('p', { className: 'job-target' }, [
      node('strong', { textContent: '來源：' })
    ]);
    const targetUrl = safeHttpUrl(job.url);
    if (targetUrl) {
      target.append(node('a', {
        href: targetUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        textContent: job.url
      }));
    } else {
      target.append(node('span', { textContent: job.url || '無網址' }));
    }
    const bar = node('div', { className: 'progress-bar' });
    bar.style.width = String(Math.max(0, Math.min(100, progress.ratio * 100))) + '%';
    const chapterDownloadBar = node('div', { className: 'progress-bar chapter-download-bar' });
    chapterDownloadBar.style.width = String(Math.max(0, Math.min(100, progress.chapterDownloadRatio * 100))) + '%';
    const progressSummary = node('p', { className: 'job-meta' }, [
      node('span', { className: 'job-chapter-progress', textContent: progress.chapterLabel }),
      node('span', { textContent: progress.detailLabel }),
      node('span', { textContent: '類型：' + (job.kind || '-') })
    ]);
    const left = node('div', { className: 'job-progress' }, [
      progressSummary,
      node('div', { className: 'progress-section' }, [
        node('div', { className: 'progress-caption', textContent: '全部章節' }),
        node('div', { className: 'progress-track', 'aria-label': '全部章節進度' }, [bar])
      ]),
      node('div', { className: 'progress-section current-chapter-progress' }, [
        node('div', { className: 'progress-caption' }, [
          node('span', { textContent: '目前章節下載' }),
          node('span', { className: 'progress-caption-detail', textContent: progress.chapterDownloadLabel })
        ]),
        node('div', { className: 'progress-track', 'aria-label': '目前章節下載進度' }, [chapterDownloadBar])
      ])
    ]);
    if (job.diagnostic) {
      left.append(node('p', {
        className: 'error-text',
        textContent: '診斷：' + job.diagnostic
      }));
    }
    const outputPanel = node('div', { className: 'outputs' }, [
      node('h3', { textContent: '可下載檔案' })
    ]);
    if (job.downloadAll) {
      outputPanel.append(node('a', {
        className: 'all-download',
        href: prefixed(job.downloadAll),
        textContent: '下載全部已完成檔案'
      }));
    }
    const groups = Array.isArray(job.outputGroups) ? job.outputGroups : [];
    if (groups.length) {
      groups.forEach(group => {
        const links = node('div', { className: 'download-list' });
        (group.downloads || []).forEach(download => appendDownload(links, download));
        outputPanel.append(node('div', { className: 'output-group' }, [
          node('strong', {
            textContent: group.label || '第 ' + ((group.chapterIndex || 0) + 1) + ' 章'
          }),
          links
        ]));
      });
    } else if (Array.isArray(job.downloads) && job.downloads.length) {
      const links = node('div', { className: 'download-list' });
      job.downloads.forEach(download => appendDownload(links, download));
      outputPanel.append(links);
    } else {
      outputPanel.append(node('p', {
        className: 'empty',
        textContent: job.status === 'running'
          ? '完成的章節會在這裡出現。'
          : '尚未產生可下載檔案。'
      }));
    }
    const actions = node('div', { className: 'job-actions' });
    appendActions(actions, job);
    const identity = node('p', {
      className: 'job-identity hint',
      textContent: 'binding ' + (job.bindingId || '-') +
        ' · browser ' + (job.browserClientId || '-') +
        ' · service ' + (job.serviceClientId || '-') +
        ' · Bridge ' + (job.bridgeUrl || '-')
    });
    return node('details', {
      className: 'job-card',
      'data-job-id': job.id,
      open: expandedJobIds.has(job.id)
    }, [
      summary,
      node('div', { className: 'job-details' }, [
        target,
        identity,
        node('div', { className: 'job-grid' }, [
          left,
          outputPanel
        ]),
        actions
      ])
    ]);
  };

  const renderJobs = jobs => {
    const list = document.querySelector('#jobs');
    const expandedJobIds = new Set(
      [...document.querySelectorAll('#jobs details[data-job-id][open]')].map(item => item.dataset.jobId)
    );
    list.textContent = '';
    const counts = jobs.reduce((result, job) => {
      result[job.status] = (result[job.status] || 0) + 1;
      return result;
    }, {});
    document.querySelector('#stats').replaceChildren(...[
      ['running', '執行中'],
      ['queued', '排隊'],
      ['complete', '完成'],
      ['error', '失敗'],
      ['cancelled', '取消']
    ].map(([key, label]) => node('span', { className: 'stat' }, [
      node('strong', { textContent: counts[key] || 0 }),
      node('span', { textContent: label })
    ])));
    if (!jobs.length) {
      list.append(node('div', {
        className: 'job-card empty',
        textContent: '目前沒有下載工作。'
      }));
      return;
    }
    jobs.slice().reverse().forEach(job => list.append(renderJob(job, expandedJobIds)));
  };

  const renderBinding = binding => {
    const profile = Array.isArray(binding.bindings) && binding.bindings.length
      ? binding.bindings[0]
      : binding;
    const bindingId = document.querySelector('#bindingId');
    if (bindingId) bindingId.textContent = profile?.bindingId || binding.activeBindingId || '尚未建立';
    document.querySelector('#binding').textContent =
      (binding.paired ? '已綁定' : '尚未綁定') +
      ' · ' + (binding.bridgeUrl || '-') +
      ' · callback ' + (binding.callbackUrl || '-');
    const connection = document.querySelector('#connection');
    connection.dataset.state = binding.paired ? 'ok' : 'bad';
    connection.textContent = binding.paired ? 'Bridge 已連線' : 'Bridge 未連線';
  };

  const render = data => {
    renderBinding(data.binding || {});
    renderJobs(data.jobs || []);
  };

  async function refresh() {
    try {
      const response = await fetch(browserBase + '/api/state', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('state_http_' + response.status);
      const data = await response.json();
      document.querySelector('#bridgeUrl').value = data.binding?.bridgeUrl || '';
      document.querySelector('#callbackUrl').value = data.binding?.callbackUrl || '';
      render(data);
    } catch (error) {
      const connection = document.querySelector('#connection');
      connection.dataset.state = 'bad';
      connection.textContent = '服務未連線';
      setFeedback('#status', error.message, true);
    }
  }

  async function renewCsrf() {
    const response = await fetch(browserBase + '/api/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 32) {
      throw new Error(payload.error || 'csrf_refresh_failed');
    }
    csrf = payload.csrfToken;
  }

  async function post(path, body = {}, retry = true) {
    const response = await fetch(browserBase + path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(body)
    });
    if (retry && response.status === 403) {
      const payload = await response.clone().json().catch(() => ({}));
      if (payload.error === 'csrf_forbidden') {
        await renewCsrf();
        return post(path, body, false);
      }
    }
    return response;
  }

  async function responsePayload(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'http_' + response.status);
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  document.querySelector('#saveConfig').onclick = async () => {
    try {
      const payload = await responsePayload(await post('/api/config', {
        bridgeUrl: document.querySelector('#bridgeUrl').value,
        callbackUrl: document.querySelector('#callbackUrl').value
      }));
      setFeedback('#configStatus', payload.rebindRequired
        ? 'Bridge URL 已變更，請重新輸入六碼配對碼'
        : '設定已儲存');
      await refresh();
    } catch (error) {
      setFeedback('#configStatus', error.message, true);
    }
  };

  document.querySelector('#pair').onclick = async () => {
    try {
      await responsePayload(await post('/api/bridge/pair', {
        code: document.querySelector('#pairCode').value,
        bridgeUrl: document.querySelector('#bridgeUrl').value,
        serviceClientId: browserServiceId
      }));
      setFeedback('#configStatus', 'Bridge 綁定成功');
      await refresh();
    } catch (error) {
      setFeedback('#configStatus', error.message, true);
    }
  };

  document.querySelector('#form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await responsePayload(await post('/api/jobs', {
        url: document.querySelector('#url').value,
        kind: document.querySelector('#kind').value
      }));
      setFeedback('#status', '已加入佇列');
      await refresh();
    } catch (error) {
      setFeedback('#status', error.message, true);
    }
  });

  document.querySelector('#clearFailed').onclick = async () => {
    const button = document.querySelector('#clearFailed');
    if (button.disabled) return;
    if (!confirm('清除所有失敗與已取消工作紀錄，並刪除其相關 EPUB、KEPUB 與暫存檔？已完成工作會保留。')) return;
    button.disabled = true;
    button.textContent = '清除中…';
    try {
      const payload = await responsePayload(await post('/api/jobs/clear-failed'));
      setFeedback('#status', '已清除 ' + (payload.deleted || 0) + ' 筆失敗／取消工作與相關檔案');
      await refresh();
    } catch (error) {
      const deleted = Number(error.payload?.deleted || 0);
      const partial = deleted > 0 ? '；已先清除 ' + deleted + ' 筆' : '';
      setFeedback('#status', '清除失敗：' + error.message + partial, true);
      await refresh();
    } finally {
      button.disabled = false;
      button.textContent = '清除失敗與取消紀錄';
    }
  };

  document.querySelector('#jobs').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.jobId;
    if (!id || pendingActions.has(id)) return;
    if (action === 'cancel' && !confirm('取消後會刪除這個工作已下載的檔案，確定繼續嗎？')) return;
    if (action === 'delete' && !confirm('刪除這個工作紀錄與相關檔案，確定繼續嗎？')) return;
    pendingActions.add(id);
    button.disabled = true;
    button.textContent = action === 'delete' ? '刪除中…' : '處理中…';
    setFeedback('#status', action === 'delete' ? '正在驗證並刪除工作檔案…' : '正在處理工作…');
    try {
      const payload = await responsePayload(await post('/api/jobs/' + encodeURIComponent(id) + '/' + action));
      if (action === 'delete') {
        if (payload.deleted !== true || payload.jobId !== id) throw new Error('delete_not_confirmed');
        setFeedback('#status', '已刪除工作與 ' + (payload.removedOutputs || 0) + ' 個輸出檔案');
      } else {
        setFeedback('#status', action === 'cancel' ? '工作已取消，相關檔案已清除' : '工作操作完成');
      }
    } catch (error) {
      setFeedback('#status', '操作失敗：' + error.message, true);
    } finally {
      pendingActions.delete(id);
      await refresh();
    }
  });

  const events = new EventSource(browserBase + '/api/events');
  events.onmessage = event => {
    try {
      render(JSON.parse(event.data));
    } catch {
      setFeedback('#status', '進度資料格式錯誤', true);
    }
  };
  events.onerror = () => {
    const connection = document.querySelector('#connection');
    if (connection.dataset.state !== 'ok') {
      connection.dataset.state = 'bad';
      connection.textContent = '進度串流重新連線中';
    }
  };

  refresh();
})();
