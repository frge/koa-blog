const compose = require('./compose');
const debug = require('debug')('router');
const HttpError = require('http-errors');
const p2r = require('path-to-regexp');
const URLSearchParams = require('url-search-params');

const layerMap = new Map();
const METHODS = require('http').METHODS || ['HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE'];

class Layer {
  constructor(methods, pattern, fns, options = {}) {
    this.originalPattern = pattern;
    this.methods = methods.map(m => m.toUpperCase());
    this.name = options.name;
    this.defaults = options.defaults;
    this.requirements = options.requirements;
    this.fns = fns;
    this.prepare(pattern);
    if (this.name) layerMap.set(this.name, this);
  }

  prepare(pattern) {
    if (pattern === this.pattern) {
      return this;
    }

    if (layerMap.has(this.pattern)) {
      layerMap.delete(this.pattern);
    }

    layerMap.set(pattern, this);

    this.isStar = pattern === '*';
    this.isSlash = pattern === '/';
    this.pattern = pattern;

    this.tokens = [];
    this.regexp = p2r(pattern, this.tokens);
    this.urlFor = p2r.compile(pattern.replace(/\(\.\*\)/g, ''));

    return this;
  }

  setPrefix(prefix, replace = false) {
    if (!prefix || prefix === '/' || prefix === '*') return this;
    if (!replace) this.prepare(prefix + this.pattern);
    else this.prepare(prefix + this.originalPattern);
    return this;
  }

  callback() {
    const layer = this;
    const callback = compose(layer.fns);
    return function (ctx, next) {
      if (!ctx.params) ctx.params = {};
      if (!ctx.allowed) ctx.allowed = [];// not allowed methods
      console.log(ctx.path, ctx.method);
      const matches = layer.match(ctx.path, ctx.method);
      if (!matches) return next();// not match
      ctx.allowed.push(layer);
      if (matches.ok) ctx.params = matches.params;
      return matches.ok ? callback(ctx, next) : next();
    }
  }

  match(path, method) {
    debug('test %s %s', this.pattern, this.regexp);

    if (path == null || typeof path !== 'string') {
      return null;
    }

    const params = Object.create(this.defaults || {});
    const methods = this.methods;
    const ok = methods.length === 0 || methods.indexOf(method) > -1;

    // fast path non-ending match for / (any path matches)
    if (this.isSlash) {
      return {params, path: '', ok};
    }

    // fast path for * (everything matched in a param)
    if (this.isStar) {
      params[0] = decodeParam(path);
      return {params, path, ok};
    }

    const match = this.regexp.exec(path);
    if (match == null) {
      return null;
    }

    const keys = this.tokens;

    // iterate matches
    for (let i = 1; i < match.length; i++) {
      const key = keys[i - 1];
      const prop = key.name;
      const val = decodeParam(match[i]);

      if (val !== undefined || !(hasOwn(params, prop))) {
        if (key.pattern !== '[^\\\\/]+?') params[prop] = val;
        else if (this.validate(prop, val)) params[prop] = val;
        else throw new URIError('invalid params');
      }
    }

    return {params, path: match[0], ok};
  }

  validate(key, value) {
    if (!this.requirements) return true;
    const validator = this.requirements[key];
    return !validator || validate(value, validator);
  }

  url(params, query, hash) {
    const replace = Object.create(this.defaults || {});
    const tokens = this.tokens;

    if (params instanceof Array) {
      let len = tokens.length, i = 0, j = 0;
      for (; i < len; i++) {
        if (tokens[i].name) {
          replace[tokens[i].name] = params[j++];
        }
      }
    } else if (tokens.some(token => token.name) && params) {
      Object.keys(params).forEach(key => {
        replace[key] = params[key];
      });
    }

    return this.urlFor(replace)
      + (query ? '?' + new URLSearchParams(query) : '')
      + (hash ? '#' + hash : '');
  }
}

class Router {
  constructor(prefix, methods = METHODS) {
    this.prefix = prefix || '/';
    this.methods = methods.map(m => m.toUpperCase());
    this.stack = [];
  }

  use(...fns) {
    if (!fns.length) return this;
    const stack = fns.map(fn => funcize(fn, this));
    this.stack.push(stack.length === 1 ? stack[0] : compose(stack));
    return this;
  }

  route(methods, pattern, fns, options = {}) {
    if (typeof options === "string") options = {name: options};
    if (!Array.isArray(fns)) fns = [fns];
    const layer = new Layer(methods, pattern, fns, options);
    layer.setPrefix(this.prefix, true);
    this.stack.push(layer.callback());
    return this;
  }

  all(pattern, fns, options = {}) {
    return this.route(this.methods, pattern, fns, options);
  }

  match(path, method) {
    return path.startsWith(this.prefix)
      && this.methods.some(m => m === method);
  }

  routes() {
    const callback = compose(this.stack);
    const router = this;

    return function (ctx, next) {
      debug('%s %s', ctx.method, ctx.path);
      return router.match(ctx.path, ctx.method)
        ? callback(ctx, next)
        : next();
    }
  }

  allowedMethods(options = {}) {
    const implemented = this.methods;

    function getAllowed(ctx) {
      const allowed = {};

      if (Array.isArray(ctx.allowed)) {
        ctx.allowed.forEach(layer => {
          layer.methods.forEach(method => {
            allowed[method] = method;
          });
        });
      }

      return Object.keys(allowed);
    }

    function throwNotAllowedError(ctx, allowed, status) {
      if (options.throw) {
        // not Implemented Throwable;
        if (typeof options.notImplemented === 'function') {
          // set whatever the user returns from their function
          throw options.notImplemented();
        }

        throw new HttpError.NotImplemented();
      }

      ctx.status = status;
      ctx.set('Allow', allowed.join(', '));
    }

    return async function (ctx, next) {
      await next();

      if (ctx.status && ctx.status !== 404) {
        return;
      }

      const allowed = getAllowed(ctx);
      const method = ctx.method;

      if (!~implemented.indexOf(method)) {
        throwNotAllowedError(ctx, allowed, 501);
      } else if (allowed.length) {
        if (method === 'OPTIONS') {
          ctx.status = 200;
          ctx.body = '';
          ctx.set('Allow', allowed.join(', '));
        } else if (!allowed[method]) {
          throwNotAllowedError(ctx, allowed, 405);
        }
      }
    }
  }
}

function urlFor(name, data, query, hash) {
  return layerMap.has(name)
    ? layerMap.get(name).url(data, query, hash)
    : new Error("No route found for name: " + name);
}

function validate(value, validator) {
  if (validator instanceof RegExp) return validator.test(value);
  if (Array.isArray(validator)) return validator.some(v => validator(value, v));
  if (typeof validator === 'function') return !!validator(value);
  if (typeof validator !== 'string') return validator === value;
  return validator.split('|').some(s => s === value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function decodeParam(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = `Failed to decode param '${val}'`;
      err.status = 400;
    }

    throw err;
  }
}

function funcize(fn, router) {
  // for koa
  if (fn.middleware) {
    return compose(fn.middleware);
  }

  if (fn instanceof Router) {
    return fn.routes();
  }

  if (fn instanceof Layer) {
    fn.setPrefix(router.prefix, true);
    return fn.callback();
  }

  return fn;
}

Router.urlFor = urlFor;
Router.Layer = Layer;
Router.METHODS = METHODS;

module.exports = Router;


//
// const Koa = require('koa');
//
// const app = new Koa();
//
// const router = new Router('/v');
// router.route(['GET'], '/index', async function (ctx, next) {
//   await next();
//   ctx.body = 'hjome';
// });
//
// router.use(function (ctx, next) {
//   ctx.body = 'into';
//   return next();
// });
//
//
// app.use(router.routes());
// app.listen(88);
