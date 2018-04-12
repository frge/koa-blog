const path = require('path');
const logger = require('koa-logger');
const body = require('koa-body');
const hbs = require('./handlebars');
const config = require('../config');

const resolve = path.join.bind(path, __dirname, '..');
const routes = require('./routes')(resolve('routes'));
const serve = require('./static')(resolve('public'));
const viewPath = resolve('views');

module.exports = function (app, config) {
  // views
  app.use(hbs.middleware({
      viewPath,
      locals: {},
      disableCache: app.env === 'production'
  }));

  // logger
  app.use(logger());

  // static
  app.use(serve.less(viewPath));
  app.use(serve.static());

  // body parser
  app.use(body());

  // routes
  app.use(routes.context());
  app.use(routes.callback());
  app.use(routes.allowedMethods());

  return app;
};
