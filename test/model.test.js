const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, dockBounds, blocks } = require('../src/model');
test('settings constrain invalid persisted or renderer values', () => {
  const s = normalize({ speed: -30, width: 99999, fontSize: 'bad', script: 42, position: -1 });
  assert.equal(s.speed, 5); assert.equal(s.width, 1200); assert.equal(s.fontSize, 30); assert.equal(s.position, 0);
  assert.equal(typeof s.script, 'string'); assert.equal(s.protected, true);
});
test('docking handles negative monitor coordinates, offsets and small screens', () => {
  const d = { workArea: { x: -1920, y: -100, width: 1920, height: 1080 } };
  assert.deepEqual(dockBounds(normalize(), d), { x: -1270, y: -100, width: 620, height: 330 });
  assert.equal(dockBounds(normalize({ offset: 1500 }), d).x, -620);
  assert.deepEqual(dockBounds(normalize(), { workArea: { x: 0, y: 0, width: 400, height: 240 } }), { x: 0, y: 0, width: 400, height: 240 });
});
test('Obsidian Markdown keeps headings and readable link labels', () => {
  const result = blocks('---\ntags: lecture\n---\n# Introduction\nRead **this** and [[Topic|an example]] or [a source](https://example.com).\n<script>alert(1)</script>');
  assert.deepEqual(result[0], { heading: true, text: 'Introduction' });
  assert.equal(result[1].text, 'Read this and an example or a source.');
  assert.equal(result[2].text, '<script>alert(1)</script>');
});
