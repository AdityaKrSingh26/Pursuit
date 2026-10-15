export function resumePdfState(version) {
  if (version.renderStatus === 'FAILED') {
    return { kind: 'failed', error: version.renderError || 'PDF render failed' }
  }
  if (version.renderStatus !== 'DONE' || !version.pdfKey) {
    return { kind: 'rendering' }
  }
  return { kind: 'ready', pdfKey: version.pdfKey }
}
