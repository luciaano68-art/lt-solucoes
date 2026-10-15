import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('chat feedback is placed at the top and cannot block composer interaction',()=>{
 assert.match(css,/\.chat-mode \.toast\{top:[^}]+bottom:auto[^}]+pointer-events:none/);
 assert.match(css,/\.chat-mode\.chat-keyboard \.toast\{top:/);
});
test('compact chat retains scroll, keyboard focus, touch targets and failure status',()=>{
 assert.match(css,/\.connection:not\(\.bad\)\{display:none/);
 assert.match(css,/\.chat-stream:focus-visible\{outline:1px dashed/);
 assert.match(css,/\.chat-compose button\{width:44px;min-width:44px;height:44px;min-height:44px/);
 assert.match(css,/\.chat-stream\{flex:1;min-height:0;overflow-y:auto/);
});
test('release version is consistent in application, document and offline worker',()=>{
 const root=new URL('../',import.meta.url),version=JSON.parse(readFileSync(new URL('app-version.json',root))).version;
 for(const file of ['index.html','app.js','sw.js']) assert.ok(readFileSync(new URL(file,root),'utf8').includes(version),file);
});
