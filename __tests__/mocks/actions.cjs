const fn = () => {}

module.exports = {
  addPath: fn,
  debug: fn,
  endGroup: fn,
  error: fn,
  exportVariable: fn,
  getBooleanInput: fn,
  getInput: fn,
  getState: fn,
  group: async (_name, action) => action(),
  info: fn,
  saveState: fn,
  setFailed: fn,
  setOutput: fn,
  startGroup: fn,
  warning: fn,
  saveCache: fn,
  restoreCache: fn,
  hashFiles: fn,
  exec: fn,
  downloadTool: fn,
  extractTar: fn,
  extractZip: fn,
  context: {
    serverUrl: 'https://github.com',
    repo: { owner: 'testowner', repo: 'testrepo' }
  }
}
