const path = require('path');
const fs = require('fs');

const hbs = require('./handlebars');
const routers = require('./routers');
const logger = require('koa-logger');
const serve = require('koa-static');
const body = require('koa-body');

const resolve = path.join.bind(path, __dirname, '..');
const viewPath = resolve('views');
const resPath = resolve('public');
const middleware = [];

fs.readdirSync(__dirname).forEach(file => {
  if (file === 'index.js') return;
  if (file === 'handlebars.js') return;
  if (file === 'routers.js') return;
  if (file.startsWith('.')) return;
  try {
    const fn = require(require.resolve(__dirname + '/' + file));
    if (typeof fn !== "function") return;
    middleware.push(fn);
  } catch (e) {
  }
});

module.exports = function (app) {
  // handlebars
  app.use(hbs.middleware({
      viewPath,
      locals: {},
      disableCache: app.env === 'production'
  }));

  // logger
  app.use(logger());

  // static
  app.use(less(viewPath, {dest: resPath}));
  app.use(serve(resPath));

  app.use(body());
  app.use(routers(resolve('routes')));

  middleware.forEach(fn => {
    app.use(fn);
  });

  return app;
};

function less(root, options) {
  const render = require('less-middleware')(root, options);

  return function (ctx, next) {
    return render(ctx.req, ctx.res, next);
  };
}
