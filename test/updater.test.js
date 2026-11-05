const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { cleanError, createUpdateController } = require('../src/updater');

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.downloads = 0;
    this.installs = 0;
    this.installArguments = null;
  }

  async checkForUpdates() {
    this.checks += 1;
    this.emit('checking-for-update');
  }

  async downloadUpdate() {
    this.downloads += 1;
  }

  quitAndInstall(isSilent, isForceRunAfter) {
    this.installs += 1;
    this.installArguments = [isSilent, isForceRunAfter];
  }
}

function controllerFixture(packaged = true) {
  const updater = new FakeUpdater();
  const broadcasts = [];
  let beforeInstallCalls = 0;
  const controller = createUpdateController({
    updater,
    isPackaged: () => packaged,
    getVersion: () => '1.1.1',
    broadcast: (state) => broadcasts.push(state),
    beforeInstall: () => { beforeInstallCalls += 1; }
  });
  return { updater, broadcasts, controller, beforeInstallCalls: () => beforeInstallCalls };
}

test('updater remains manual and exposes the full update flow', async () => {
  const fixture = controllerFixture();
  assert.equal(fixture.updater.autoDownload, false);
  assert.equal(fixture.updater.autoInstallOnAppQuit, false);

  await fixture.controller.check();
  assert.equal(fixture.updater.checks, 1);
  assert.equal(fixture.controller.getState().status, 'checking');

  fixture.updater.emit('update-available', { version: '1.2.0' });
  assert.equal(fixture.controller.getState().status, 'available');

  await fixture.controller.download();
  assert.equal(fixture.updater.downloads, 1);
  fixture.updater.emit('download-progress', { percent: 42.5 });
  assert.equal(fixture.controller.getState().percent, 42.5);

  fixture.updater.emit('update-downloaded', { version: '1.2.0' });
  fixture.controller.install();
  assert.equal(fixture.beforeInstallCalls(), 1);
  assert.equal(fixture.updater.installs, 1);
  assert.deepEqual(fixture.updater.installArguments, [true, true]);
});

test('development builds do not contact the update provider', async () => {
  const fixture = controllerFixture(false);
  await fixture.controller.check();
  assert.equal(fixture.updater.checks, 0);
  assert.equal(fixture.controller.getState().status, 'error');
});

test('updater errors are reduced to safe single-line messages', () => {
  assert.equal(cleanError(new Error('first line\nsecond line')), 'first line second line');
  assert.equal(cleanError('x'.repeat(500)).length, 300);
});
