module.exports = function compose(middleware) {
  assert(Array.isArray(middleware), 'Middleware stack must be an array!');
  assert(middleware.every(isFn), 'Middleware must be composed of functions!');

  return function (ctx, done) {
    // last called middleware
    let index = -1;

    function dispatch(i) {
      if (i <= index) {
        const err = new Error('next() called multiple times');
        return Promise.reject(err);
      }

      index = i;

      let fn = middleware[i];
      if (i === middleware.length) fn = done;
      if (!fn) return Promise.resolve();

      try {
        const next = () => dispatch(i + 1);
        if (isFn(fn)) return Promise.resolve(fn(ctx, next));
        if (ctx.silent) return Promise.resolve(next());
        assert(false, "middleware is not a function, give " + fn + "!");
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
};

function assert(value, msg) {
  if (!value) {
    throw new TypeError(msg);
  }
}

function isFn(fn) {
  return fn && typeof fn === 'function';
}
