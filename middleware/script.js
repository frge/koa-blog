const path = require("path");
const rollup = require("rollup");

function removeDot(e) {
  return (e = e.trim())[0] === '.' ? e.slice(1) : e;
}

function extensionToRegex(exts) {
  if (Array.isArray(exts)) exts = exts.join(',');
  if (typeof exts !== "string") exts = '';
  exts = (exts + ',js').toLowerCase().split(',');
  exts = [...new Set(exts.map(removeDot).filter(e => !!e))];
  exts = exts.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  return new RegExp('\\.(' + exts.join('|') + ')$', 'i');
}

module.exports = function (root, options = {}) {
  const RE = extensionToRegex(options.extensions);
  const METHODS = {GET: true, HEAD: true};

  const isValidPath = function (path) {
    return RE.test(path);
  };

  return async function (ctx, next) {
    if (METHODS[ctx.method] !== true || !isValidPath(ctx.path)) {
      return next();
    }

    const source = path.resolve(__dirname + '/../views/scripts/bar.js');
    const file = path.resolve(__dirname + '/../public/scripts/bar.js');

    const bundle = await rollup.rollup({
      input: source,
      plugins: [require('rollup-plugin-buble')()]
    });

    const imports = bundle.modules.map(module => module.id);

    console.log(imports);

    await bundle.write({
      file: file,
      format: 'umd',
      name: path.basename(file, path.extname(file))
    });

    await next();
  }
};
