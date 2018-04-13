const path = require("path");
const rollup = require("rollup");
const fs = require('fs');
const {promisify} = require('util');

const statFile = promisify(fs.stat);
const cacheMap = {};

const regex = {
  compress: /([.\-])min\.js$/,
  handle: /\.js(\.map)?$/,
  sourceMap: /\.js\.map$/
};

function logMessage(key, value, type) {
  // Only log for errors.
  if(type !== 'error') return;
  console[type]("  \u001b[90m%s :\u001b[0m \u001b[36m%s\u001b[0m", key, value);
}

function logDebug(key, value, type) {
  switch(type) {
    case 'log':
    case 'info':
    case 'error':
    case 'warn':
      break;
    default:
      type = 'log';
  }

  console[type]("  \u001b[90m%s :\u001b[0m \u001b[36m%s\u001b[0m", key, value);
}

function isCompressedPath(pathname) {
  return regex.compress.test(pathname);
}

function isValidPath(pathname) {
  return regex.handle.test(pathname);
}

function extend(target, source) {
  Object.keys(source).forEach(key => {
    const value = source[key];
    if (value === undefined) return;
    if (Array.isArray(value)) target[key] = value;
    else if (typeof value !== "object") target[key] = value;
    else target[key] = extend(target[key] || {}, value);
  });
  return target;
}

function throwIf(value, e) {
  if (value) throw e;
}

function checkImports(path) {
  let nodes = cacheMap[path];
  nodes = nodes && nodes.imports;
  if (!nodes || !nodes.length) {
    return null;
  }

  const changed = [];

  return Promise.all(nodes.map(imported => statFile(imported.path)
  // 如果依赖的文件被修改或者被删除了，则源文件应该重新编译
    .then(stat => !imported.mtime || stat.mtime > imported.mtime)
    .catch(() => true)// 文件被删除了
    .then(isChange => isChange && changed.push(imported.path))))
    .catch(() => undefined /*容错处理，不让其它地方捕获*/)
    .then(() => changed);
}

const processImport = function (imported, log) {
  const currentImport = {
    path: imported,
    mtime: null
  };

  // Update the mtime of the import async.
  statFile(imported)
    .then(stats => currentImport.mtime = stats.mtime)
    .catch(e => throwIf('ENOENT' !== e.code, e))
    .catch(log);

  return currentImport;
};

function skip(lessPath, cssPath) {
  return statFile(lessPath).then(function (stat) {
    if (!stat.isFile()) return true;// “源”不是文件，不能编译
    return statFile(cssPath)
    // 目标不是文件不能编译“源”；目标文件尚未过期，也不需要编译。
      .then(stat2 => !stat2.isFile() || stat2.mtime > stat.mtime)
      .catch(() => false);// 目标文件不存在，需要编译
  }).catch(() => true);// 源文件不存在，不能编译
}

module.exports = function (root, opts = {}) {
  const dest = opts.dest = opts.dest || root;
  const extensions = opts.extensions || ['.js', '.jsx'];
  const METHODS = {GET: true, HEAD: true};

  // The log function is determined by the debug option.
  const log = opts.debug ? logDebug : logMessage;

  return async function (ctx, next) {
    if (METHODS[ctx.method] !== true || !isValidPath(ctx.path)) {
      return next();
    }

    const prefix = path.join(root, ctx.path.replace(regex.handle, ''));
    let source;

    for (let i = 0; i < extensions.length; i++) {
      try {
        const stat = statFile(prefix + extensions[i]);
        if (!stat.isFile()) continue;
        source = prefix + extensions[i];
        break;
      } catch (e) {
        // 文件不存在
      }
    }

    if (source) {
      const file = path.join(dest, ctx.path.replace(regex.handle, '.js'));
      let needCompile = false;

      // 1、Force recompile of all files.
      // 2、Compile on (uncached) server restart and new files.
      if (opts.force || !cacheMap[source]) {
        needCompile = !(await skip(source, file));
      } else {
        const changed = await checkImports(source);
        needCompile = changed && changed.length > 0;
      }

      if (needCompile) {
        const bundle = await rollup.rollup({
          input: source,
          plugins: [require('rollup-plugin-buble')()]
        });

        const imports = bundle.modules.map(module => module.id);
        // Store the less paths for simple cache invalidation.
        cacheMap[source] = {
          imports: imports.map((imported) => processImport(imported, log)),
          mtime: Date.now()
        };

        await bundle.write({
          file: file,
          format: 'umd',
          name: path.basename(file, path.extname(file))
        });
      }
    }

    await next();
  }
};
