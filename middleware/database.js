const fs = require('fs');
const Sequelize = require('sequelize');

function getModels(root) {
  const parsed = {};

  fs.readdirSync(root).forEach(file => {
    if (file.startsWith('.')) return;
    if (!file.endsWith('.js')) return;
    try {
      const path = require.resolve(root + '/' + file);
      const module = require(path);
      console.log(module);
    } catch (e) {
      console.error(e);
    }
  });

  return parsed;
}

module.exports = function (config) {
  const sequelize = new Sequelize(config);
  sequelize.authenticate(console.log.bind(console)).then().catch(console.error.bind(config));
  return function (ctx, next) {
    ctx.models = {};
    return next();
  }
};


