// Guard against the nesting that breaks Firefox.  Compiling a worker script
// costs stack, and Firefox allows only 1 MB; at depth 569 that overflowed on
// macOS and the worker died silently.  Usage: node check_ast_depth.js F MAX
const acorn = require('acorn');
const fs = require('fs');

const [file, max] = [process.argv[2], parseInt(process.argv[3], 10)];
if (!file || !Number.isFinite(max)) {
  console.error('usage: node check_ast_depth.js <file.js> <maxDepth>');
  process.exit(2);
}

const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });

// Iterative walk; recursing here would hit the same limit we are measuring.
let depth = 0;
const stack = [[ast, 1]];
while (stack.length) {
  const [node, d] = stack.pop();
  if (d > depth) depth = d;
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) if (c && typeof c.type === 'string') stack.push([c, d + 1]);
    } else if (val && typeof val.type === 'string') {
      stack.push([val, d + 1]);
    }
  }
}

console.log(`${file}: ${src.length} bytes, max AST depth ${depth} (limit ${max})`);
if (depth > max) {
  console.error(`FAIL: depth ${depth} exceeds ${max}.  Firefox on macOS will` +
                ` fail to compile this in a Web Worker, reporting only a bare` +
                ` error event with no message.  See the hol_top_worker.js rule` +
                ` in the Makefile.`);
  process.exit(1);
}
