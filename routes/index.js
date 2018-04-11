/**
 * @mount('/v1')
 * @middleware('')
 */
class Index {
  /**
   * @get('/', name='home', defaults={})
   * @middleware()
   * @middleware()
   */
  async index (ctx, next) {
    await next();
    ctx.body = 'done';
  }

  /**
   * @get('/search', name="search")
   */
  search(ctx, next) {
    ctx.body = 'search';
    return next();
  }
}

module.exports = Index;
