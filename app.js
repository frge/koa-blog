const middleware = require('./middleware');
const Koa = require('koa');
const config = require('./config');
const app = new Koa();

// init middleware
middleware(app, config);

// listen
const HOST = config.host || process.env.HOST || '0.0.0.0';
const PORT = config.port || process.env.PORT || 3000;
app.listen(PORT, HOST);

