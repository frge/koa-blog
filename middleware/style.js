const less = require('less');
const fs = require('fs');
const path = require("path");
const mkdirp = require("mkdirp");
const {promisify} = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const statFile = promisify(fs.stat);

const cacheMap = {};

const regex = {
  compress: /([.\-])min\.css$/,
  handle: /\.css(\.map)?$/,
  sourceMap: /\.css\.map$/
};

const defaultOptions = {
  cacheFile: null,
  debug: false,
  dest: null,
  force: false,
  postprocess: {
    css: (css, req) => css,
    sourcemap: (sourcemap, req) => sourcemap
  },
  preprocess: {
    less: (src, req) => src,
    path: (pathname, req) => pathname,
    importPaths: (paths, req) => paths,
  },
  render: {
    compress: 'auto',
    yuicompress: false,
    paths: []
  },
  storeCss: async function (pathname, css, req) {
    await mkdir(path.dirname(pathname), 511/* 0777 */);
    await writeFile(pathname, css, {encoding: 'utf8'});
  },
  storeSourcemap: async function (pathname, sourcemap, req) {
    await mkdir(path.dirname(pathname), 511/* 0777 */);
    await writeFile(pathname, sourcemap, {encoding: 'utf8'});
  }
};

let cacheFileInitialized = false;

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

function isCompressedPath(pathname) {
  return regex.compress.test(pathname);
}

function isValidPath(pathname) {
  return regex.handle.test(pathname);
}

function mkdir(dir) {
  return new Promise(function (resolve, reject) {
    mkdirp(dir, e => e ? reject(e) : resolve());
  });
}

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

function throwIf(value, e) {
  if (value) throw e;
}

/**
 * 将缓存数据保存到文件
 * @param {string} cacheFile 缓存文件
 * @param {function} log 日志函数
 */
function saveCacheToFile(cacheFile, log) {
  try {
    fs.writeFileSync(cacheFile, cacheFile, JSON.stringify(cacheFile, null, 2));
    log('successfully cached imports to file');
  } catch (e) {
    log('error caching imports to file', cacheFile, e);
  }
}

/**
 * 自缓存文件中加载缓存的编译数据
 * @param {string} cacheFile 缓存文件
 * @param {function} log 日志函数
 */
function loadCacheFile(cacheFile, log) {
  try {
    let data = fs.readFileSync(cacheFile, {encoding: 'utf8'}).trim();
    if (!data) return;

    try {
      data = JSON.parse(data);
      data && extend(cacheMap, data);
    } catch (err) {
      log('error parsing cached imports in file ' + cacheFile, err);
    }
  } catch (e) {
  }
}

/**
 * 初始化缓存
 * @param {string} cacheFile 缓存文件
 * @param {function} log 日志函数
 */
function initCache(cacheFile, log) {
  let cacheFileSaved = false;
  cacheFileInitialized = true;

  const _saveCacheToFile = function () {
    if (cacheFileSaved) {
      // We expect to only save to the cache file once, just before exiting
      log('cache file already appears to be saved, not saving again to', cacheFile);
    } else {
      cacheFileSaved = true;
      saveCacheToFile(cacheFile, log);
    }
  };

  process.on('exit', _saveCacheToFile);
  process.once('SIGUSR2', function () {
    // Handle nodemon restarts
    _saveCacheToFile();
    process.kill(process.pid, 'SIGUSR2');
  });
  process.once('SIGINT', function () {
    _saveCacheToFile();
    // Let other SIGINT handlers run, if there are any
    process.kill(process.pid, 'SIGINT');
  });

  loadCacheFile(cacheFile, log);
}

/**
 * 获取变化的依赖的文件
 * @param {string} path 当前编译的文件
 * @returns {Promise<string[]> | null} 发生变化的文件列表
 */
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

// Determine the imports used and check modified times.
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

function compile(lessPath, cssPath, opts, renderOpts, req, log) {
  return readFile(lessPath, {encoding: 'utf8'}).then(function (lessSrc) {
    delete cacheMap[lessPath];
    renderOpts.filename = lessPath;
    renderOpts.paths = opts.preprocess.importPaths(opts.render.paths, req);
    lessSrc = opts.preprocess.less(lessSrc, req);
    return less.render(lessSrc, renderOpts);
  }).then(function ({imports, css, map}) {
    // Store the less paths for simple cache invalidation.
    cacheMap[lessPath] = {
      imports: imports.map((imported) => processImport(imported, log)),
      mtime: Date.now()
    };

    const tasks = [];

    if (map) {
      const mapPath = cssPath + '.map';
      // Postprocessing on the sourcemap.
      const map = opts.postprocess.sourcemap(map, req);
      // Custom sourceMap storage.
      tasks.push(opts.storeSourcemap(mapPath, map, req));
    }

    // Postprocessing on the css.
    const css = opts.postprocess.css(css, req);
    // Custom css storage.
    tasks.push(opts.storeCss(cssPath, css, req));

    return Promise.all(tasks);
  });
}

module.exports = function (root, options = {}) {
  const opts = extend(options, defaultOptions);
  const dest = opts.dest = opts.dest || root;
  const METHODS = {GET: true, HEAD: true};

  // The log function is determined by the debug option.
  const log = options.debug ? logDebug : logMessage;

  if (opts.cacheFile && !cacheFileInitialized) {
    initCache(opts.cacheFile, log);
  }

  return async function (ctx, next) {
    if (METHODS[ctx.method] !== true || !isValidPath(ctx.path)) {
      return await next();
    }

    let lessPath = path.join(root, ctx.path.replace(regex.handle, '.less'));
    let cssPath = path.join(dest, ctx.path.replace(regex.handle, '.css'));
    let needCompile = false;

    // 预处理源文件.
    lessPath = opts.preprocess.path(lessPath, ctx.req);

    // 1、Force recompile of all files.
    // 2、Compile on (uncached) server restart and new files.
    if (opts.force || !cacheMap[lessPath]) {
      needCompile = !(await skip(lessPath, cssPath));
    } else {
      const changed = await checkImports(lessPath);
      needCompile = changed && changed.length > 0;
    }

    if (needCompile) {
      const renderOpts = Object.create(options.render);

      // 未开启强制压缩代码的情况下，根据文件名称确定是否压缩
      if (!opts.render.compress) {
        renderOpts.compress = isCompressedPath(ctx.path);
      }

      await compile(lessPath, cssPath, opts, renderOpts, ctx.req, log);
    }

    await next();
  }
};
