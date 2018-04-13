const path = require('path');
const logger = require('koa-logger');
const body = require('koa-body');
const serve = require('koa-static');
const hbs = require('./handlebars');
const orm = require('./orm');
const style = require('./style');
const script = require('./script');

const resolve = path.join.bind(path, __dirname, '..');
const routes = require('./routes')(resolve('routes'));
const publicPath = resolve('public');
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

  // resources
  app.use(style(viewPath));
  app.use(script(viewPath));
  app.use(serve(publicPath));

  // ORM
  app.use(orm(resolve('models'), config.orm));

  // body parser
  app.use(body());

  // routes
  app.use(routes.context());
  app.use(routes.callback());
  app.use(routes.allowedMethods());

  return app;
};
