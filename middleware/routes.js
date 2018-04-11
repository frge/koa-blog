const fs = require('fs');
const {setvm, parse} = require('../lib/annotation');
const Router = require('../lib/router');

setvm(require('vm'));

module.exports = function (routesPath) {
  const router = new Router();

  getRoutes(routesPath).forEach(function (item) {
    parseRoutes(router, item);
  });

  return {
    context: () => injectContext(),
    callback: () => router.routes(),
    allowedMethods: opts => router.allowedMethods(opts)
  }
};

function injectContext() {
  return function (ctx, next) {
    ctx.urlFor = Router.urlFor;
    return next();
  }
}

function getRoutes(root) {
  const parsed = [];

  fs.readdirSync(root).forEach(file => {
    if (file.startsWith('.')) return;
    if (!file.endsWith('.js')) return;
    try {
      const path = require.resolve(root + '/' + file);
      const module = require(path);
      const annotation = parse(fs.readFileSync(path, {encoding: 'utf8'}));
      parsed.push({module, annotation});
    } catch (e) {
      console.error(e);
    }
  });

  return parsed;
}

function parseRoutes(router, {module, annotation}) {
  if (!module || !annotation.length) return;

  if (typeof module === 'function') {
    const name = module.name;
    if (!name) return;
    module = {[name]: module};
    parseRoutes(router, {module, annotation});
    return;
  }

  // todo 可以通过熟悉直接定义内容返回值
  annotation.forEach(function ({definition, methods}) {
    const clazz = module[definition.name];
    // 虽然写了 annotation，但是为暴露出来，或者没有注释方法
    if (!clazz || !methods.length) return;
    setRouter(router, clazz, definition, methods);
  });
}


function setRouter(container, clazz, definition, routes) {
  let mount;

  definition.annotation.forEach(function (a) {
    switch (a.annotation) {
      case 'mount':
        if (mount) throw new Error('"mount" defined multiple times');
        mount = a.parameters.value;
        break;
    }
  });

  if (!mount) {
    mount = '/';
  }

  if (typeof mount !== "string") {
    throw new Error('bad mount value, ' + mount);
  }

  const useRoot = mount === '*' || mount === '/';
  const router = useRoot ? container : new Router(mount);
  const instance = new clazz();

  const getPattern = function(a) {
    let pattern = a.parameters.value;
    if (typeof pattern !== "string") return null;
    pattern = pattern.trim();
    if (pattern.charAt(0) !== '/') pattern = '/' + pattern;
    return pattern;
  };

  const getOptions = function(a) {
    let {name, defaults, requirements} = a.parameters;
    if (typeof name !== "string") name = undefined;
    if (!isPlainObject(defaults)) defaults = undefined;
    if (!isPlainObject(requirements)) requirements = undefined;
    return {name, defaults, requirements};
  };

  const getFn = function(m) {
    return instance[m.name].bind(instance);
  };

  routes.forEach(function (m) {
    m.annotation.forEach(function (a) {
      if (~Router.METHODS.indexOf(a.annotation.toUpperCase())) {
        const pattern = getPattern(a);
        if (!pattern) return;
        router.route([a.annotation], pattern, getFn(m), getOptions(a));
        return;
      }

      let pattern;

      switch (a.annotation) {
        case 'all':
          pattern = getPattern(a);
          if (!pattern) return;
          router.all(pattern, getFn(m), getOptions(a));
          return;

        case 'route':
          pattern = getPattern(a);
          if (!pattern) return;
          let {methods} = a.parameters;
          if (!Array.isArray(methods)) throw new Error('missing method');
          router.route(methods, pattern, getFn(m), getOptions(a));
          return;
      }
    });
  });

  if (!useRoot) {
    container.use(router);
  }
}

function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
