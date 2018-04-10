/**
 * @mount('/v1')
 */
class Index {
  /**
   * @get('/')
   */
  async index (ctx, next) {
    await next();
    ctx.body = 'done';
  }
}

module.exports = Index;
