function createProgressStream(response, onClose, stallMs = 15000) {
  let blocked = false;
  let pending = null;
  let timer = null;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    pending = null;
    clearTimeout(timer);
    response.removeListener('drain', drain);
    response.removeListener('close', close);
    response.removeListener('error', fail);
    onClose();
  }
  function fail() {
    close();
    response.destroy();
  }
  function send(body) {
    if (closed) return;
    if (blocked) { pending = body; return; }
    try {
      if (!response.write(body)) {
        blocked = true;
        timer = setTimeout(fail, stallMs);
        timer.unref?.();
      }
    } catch { fail(); }
  }
  function drain() {
    clearTimeout(timer);
    timer = null;
    blocked = false;
    const latest = pending;
    pending = null;
    if (latest !== null) send(latest);
  }
  response.on('drain', drain);
  response.once('close', close);
  response.once('error', fail);
  return send;
}
module.exports = { createProgressStream };
