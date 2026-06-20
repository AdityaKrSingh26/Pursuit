export function initSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  })
  res.flushHeaders()
}

export function sendSseEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}
