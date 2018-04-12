module.exports = {
  db: {
    dialect: 'sqlite',
    operatorsAliases: false,
    storage: __dirname + '/sqlite3.db',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};
