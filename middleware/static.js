const serve = require('koa-static');

function less(root, options) {
  const render = require('less-middleware')(root, options);

  return function (ctx, next) {
    return render(ctx.req, ctx.res, next);
  };
}

module.exports = function(resPath) {
  return {
    less: (root) => less(root, {dest: resPath}),
    static: () => serve(resPath)
  }
};
