const defaults = {
  title: 'Your first lecture',
  script: '# Welcome to Lectern\n\nYour next lecture starts here.\n\nPaste your script into the editor, or open a Markdown file from Obsidian.\n\n# Find your rhythm\n\nKeep the prompter close to your webcam. A narrow column helps keep your eyes near the lens.\n\nTake a breath. Press play when you are ready.\n\nYou can pause at any time, move back a few lines, and record that sentence again.',
  speed: 32, fontSize: 30, width: 620, height: 330, opacity: 94,
  countdown: 3, protected: true, displayId: null, offset: 0, position: 0,
  docked: true, floatingBounds: null
};
function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function normalize(input = {}) {
  return {
    ...defaults,
    title: typeof input.title === 'string' ? input.title.slice(0, 160) : defaults.title,
    script: typeof input.script === 'string' ? input.script.slice(0, 2000000) : defaults.script,
    speed: clamp(input.speed, 5, 150, defaults.speed),
    fontSize: clamp(input.fontSize, 18, 64, defaults.fontSize),
    width: clamp(input.width, 340, 1200, defaults.width),
    height: clamp(input.height, 180, 700, defaults.height),
    opacity: clamp(input.opacity, 35, 100, defaults.opacity),
    countdown: clamp(input.countdown, 0, 10, defaults.countdown),
    offset: clamp(input.offset, -1500, 1500, 0),
    position: clamp(input.position, 0, 10000000, 0),
    protected: input.protected !== false,
    docked: input.docked !== false,
    displayId: Number.isInteger(input.displayId) ? input.displayId : null,
    floatingBounds: input.floatingBounds && ['x','y','width','height'].every(k => Number.isFinite(input.floatingBounds[k])) ? input.floatingBounds : null
  };
}
function dockBounds(settings, display) {
  const area = display.workArea;
  const width = Math.min(Math.round(settings.width), area.width);
  const height = Math.min(Math.round(settings.height), area.height);
  return { x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, area.x + (area.width - width) / 2 + settings.offset))), y: area.y, width, height };
}
// Return text only. Imported Markdown is never interpreted as HTML.
function blocks(script) {
  const withoutFrontmatter = script.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  return withoutFrontmatter.split(/\r?\n/).map(line => {
    const heading = /^(#{1,6})\s+(.+)/.exec(line);
    let text = heading ? heading[2] : line;
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target).replace(/[*`_]/g, '');
    return { heading: Boolean(heading), text };
  });
}
module.exports = { defaults, normalize, dockBounds, blocks };
