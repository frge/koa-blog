const mw = require('./middleware');
const Koa = require('koa');
const app = mw(new Koa());

// app.listen(3000);