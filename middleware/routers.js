const fs = require('fs');
const Router = require('koa-router');


module.exports = function (routesPath, opts = {}) {
  const constructors = getRouterConstructors(routesPath);
  const router = new Router(opts);

  Object.keys(constructors).forEach(name => {
    constructors.forEach(Constructor => {
      const prefix = name === 'index' ? '/' : `/${name}/`;
      const route = new Constructor();

      Object.keys(route).forEach(function (key) {
        if (typeof route[key] !== "function") return;
        if (key === 'constructor') return;
        router.all(name + '-' + key, prefix + key, async (ctx, next) => {
          await route[name](ctx, next);
        })
      });
    });
  });

  return async function (ctx, next) {
    await router.routes()(ctx, async () => {});
    await router.allowedMethods()(ctx, next);
  }
};

function getRouterConstructors(root) {
  const constructors = {};

  fs.readdirSync(root).forEach(file => {
    if (file.startsWith('.')) return;
    if (!file.endsWith('.js')) return;
    try {
      const path = require.resolve(root + '/' + file);
      const fn = require(path);
      if (typeof fn !== "function") return;
      constructors[kabebize(file.split('.', 2)[0])] = fn;
    } catch (e) {
      console.log(e);
    }
  });

  return constructors;
}

function kabebize(str) {
  return str.replace(/\B[A-Z]/g, '-$1').toLowerCase().replace(/^-|-$/g, '');
}
