/**
 * @mount('/v1')
 * @middleware('')
 */
class Index {
  /**
   * @get('/', {name: 'home', default: })
   * @middleware()
   * @middleware()
   */
  async index (ctx, next) {
    await next();
    ctx.body = 'done';
  }
}

module.exports = Index;
