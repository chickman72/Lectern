function cleanError(error) {
  const message = String(error?.message || error || 'The update failed.');
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function createUpdateController({
  updater,
  isPackaged,
  getVersion,
  broadcast,
  beforeInstall = () => {}
}) {
  let state = {
    status: 'idle',
    currentVersion: getVersion(),
    availableVersion: null,
    percent: 0,
    message: 'Check for updates when you are ready.'
  };

  function publish(patch) {
    state = { ...state, ...patch };
    broadcast(state);
    return state;
  }

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;

  updater.on('checking-for-update', () => publish({
    status: 'checking',
    percent: 0,
    message: 'Checking GitHub for updates…'
  }));
  updater.on('update-available', (info) => publish({
    status: 'available',
    availableVersion: info.version,
    percent: 0,
    message: `Lectern ${info.version} is available.`
  }));
  updater.on('update-not-available', () => publish({
    status: 'up-to-date',
    availableVersion: null,
    percent: 0,
    message: `Lectern ${getVersion()} is up to date.`
  }));
  updater.on('download-progress', (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    publish({
      status: 'downloading',
      percent,
      message: `Downloading Lectern ${state.availableVersion || 'update'}…`
    });
  });
  updater.on('update-downloaded', (info) => publish({
    status: 'downloaded',
    availableVersion: info.version || state.availableVersion,
    percent: 100,
    message: `Lectern ${info.version || state.availableVersion} is ready to install.`
  }));
  updater.on('error', (error) => publish({
    status: 'error',
    percent: 0,
    message: cleanError(error)
  }));

  async function check() {
    if (!isPackaged()) {
      return publish({
        status: 'error',
        message: 'Update checks are available in the installed version of Lectern.'
      });
    }
    if (['checking', 'downloading', 'downloaded'].includes(state.status)) return state;
    try {
      await updater.checkForUpdates();
    } catch (error) {
      publish({ status: 'error', percent: 0, message: cleanError(error) });
    }
    return state;
  }

  async function download() {
    if (state.status !== 'available') {
      throw new Error('Check for an available update before downloading.');
    }
    publish({
      status: 'downloading',
      percent: 0,
      message: `Downloading Lectern ${state.availableVersion}…`
    });
    try {
      await updater.downloadUpdate();
    } catch (error) {
      publish({ status: 'error', percent: 0, message: cleanError(error) });
    }
    return state;
  }

  function install() {
    if (state.status !== 'downloaded') {
      throw new Error('Download the update before installing it.');
    }
    beforeInstall();
    updater.quitAndInstall(true, true);
    return state;
  }

  return {
    getState: () => state,
    check,
    download,
    install
  };
}

module.exports = { cleanError, createUpdateController };
