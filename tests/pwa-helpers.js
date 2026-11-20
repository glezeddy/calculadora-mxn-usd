import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const declaration = /const VERSION = (['"])([^'"\n]+)\1;/;
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const match = source.match(declaration);
assert.ok(match, 'El service worker debe declarar su versión de caché');
export const currentVersion = match[2];
export function withVersion(data, version) {
  const source = data.toString();
  assert.match(source, declaration);
  assert.notEqual(version, currentVersion, 'La actualización simulada debe cambiar la versión');
  return source.replace(declaration, () => "const VERSION = '"+version+"';");
}
