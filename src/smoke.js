const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(win) {
  if (win.webContents.isLoading()) await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
  await wait(400);
}
async function run({ app, editor, prompter, snapshot, command }) {
  const errors = [];
  for (const win of [editor, prompter]) win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const result = { checks: [] };
  try {
    await Promise.all([ready(editor), ready(prompter)]);
    assert.ok(await editor.webContents.executeJavaScript("document.getElementById('script').value.length > 0"));
    result.checks.push('Editor and isolated preload load successfully');
    await editor.webContents.executeJavaScript("lectern.save({countdown:0, speed:100, script:'# Smoke test\\n\\n' + 'A lecture paragraph for scrolling.\\n\\n'.repeat(60), position:0})");
    await wait(500); prompter.show();
    assert.equal(await prompter.webContents.executeJavaScript("document.querySelectorAll('#text p.heading').length"), 1);
    result.checks.push('Script and headings synchronize between windows');
    const layout = await prompter.webContents.executeJavaScript(`({
      firstLineTop: document.querySelector('#text p').getBoundingClientRect().top,
      controlsTop: document.querySelector('header').getBoundingClientRect().top,
      readingBottom: document.getElementById('viewport').getBoundingClientRect().bottom
    })`);
    assert.ok(layout.firstLineTop <= 3, `First line should start at webcam edge, got ${layout.firstLineTop}px`);
    assert.ok(layout.controlsTop >= layout.readingBottom, 'Window controls should sit below the reading area');
    result.checks.push('Reading starts at the top edge with controls below the script');
    command('toggle'); await wait(1400);
    const position = await prompter.webContents.executeJavaScript("document.getElementById('viewport').scrollTop");
    assert.ok(position > 25, `Expected scrolling, got ${position}`);
    command('pause'); await wait(200);
    const paused = await prompter.webContents.executeJavaScript("document.getElementById('viewport').scrollTop");
    await wait(350);
    assert.equal(await prompter.webContents.executeJavaScript("document.getElementById('viewport').scrollTop"), paused);
    result.checks.push('Playback scrolls and pause holds position');
    command('back'); await wait(200);
    assert.ok(await prompter.webContents.executeJavaScript("document.getElementById('viewport').scrollTop") < paused);
    result.checks.push('Retake control moves back');
    await editor.webContents.executeJavaScript("lectern.save({docked:false})");
    await wait(200);
    assert.equal(await prompter.webContents.executeJavaScript("document.getElementById('dock').textContent"), 'Dock');
    await editor.webContents.executeJavaScript("lectern.save({docked:true, offset:50})");
    result.checks.push('Dock and undock settings synchronize');
    assert.equal(prompter.isAlwaysOnTop(), true);
    result.checks.push('Prompter stays on top');
    command('restart'); await wait(200);
    assert.equal(await prompter.webContents.executeJavaScript("document.getElementById('viewport').scrollTop"), 0);
    result.checks.push('Restart returns to beginning');
    await editor.webContents.executeJavaScript("lectern.save({script:'# Safe text\\n<script>window.pwned = true</script>', position:0})");
    await wait(300);
    assert.equal(await prompter.webContents.executeJavaScript('window.pwned === undefined'), true);
    result.checks.push('Imported script cannot execute HTML');
    result.shortcutFailures = snapshot().shortcutFailures;
    await editor.webContents.executeJavaScript("lectern.save({script:'# Welcome to Lectern\\n\\nYour next lecture starts here.\\n\\nPaste your script or open a Markdown file from Obsidian.', position:0})");
    await wait(300);
    prompter.setContentProtection(false);
    fs.writeFileSync(path.join(process.cwd(), 'smoke-editor.png'), (await editor.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(process.cwd(), 'smoke-prompter.png'), (await prompter.webContents.capturePage()).toPNG());
    assert.deepEqual(errors, []);
    result.passed = true;
  } catch (error) { result.passed = false; result.error = error.stack; }
  fs.writeFileSync(path.join(process.cwd(), 'smoke-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  app.exit(result.passed ? 0 : 1);
}
module.exports = { run };
