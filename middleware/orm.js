const fs = require('fs');
const Sequelize = require('sequelize');
const modelMap = new Map();

function initModels(sequelize, modelPath) {
  const parsed = {};
  const names = [];

  fs.readdirSync(modelPath).forEach(file => {
    if (file.startsWith('.')) return;
    if (!file.endsWith('.js')) return;

    try {
      const path = require.resolve(modelPath + '/' + file);
      const model = sequelize.import(path);
      parsed[model.name] = model;
      names.push(model.name);
    } catch (e) {
      console.error(e);
    }
  });

  names.forEach(function (name) {
    const model = parsed[name];
    if (model.associate) model.associate(parsed);
    modelMap.set(name, model);
  });
}

module.exports = function (modelPath, config) {
  const db = config.db || config.database;
  const {username, password} = config;
  const options = Object.create(config);

  options.operatorsAliases = Sequelize.Op.Aliases;
  const sequelize = new Sequelize(db, username, password, options);

  const orm = modelMap.get.bind(modelMap);
  orm.sync = sequelize.sync.bind(sequelize);
  orm.query = sequelize.query.bind(sequelize);

  initModels(sequelize, modelPath);
  orm.sync(options.force);

  return function (ctx, next) {
    ctx.orm = orm;
    return next();
  }
};
