const orm = {
// the sql dialect of the database
  // currently supported: 'mysql', 'sqlite', 'postgres', 'mssql'
  dialect: 'sqlite',

  // custom host; default: localhost
  // host: 'my.server.tld',

  // custom port; default: dialect default
  // port: 12345,

  // custom protocol; default: 'tcp'
  // postgres only, useful for Heroku
  // protocol: null,

  // disable logging; default: console.log
  // logging: false,

  // you can also pass any dialect options to the underlying dialect library
  // - default is empty
  // - currently supported: 'mysql', 'postgres', 'mssql'
  // dialectOptions: {
  //   socketPath: '/Applications/MAMP/tmp/mysql/mysql.sock',
  //   supportBigNumbers: true,
  //   bigNumberStrings: true
  // },

  // the storage engine for sqlite
  // - default ':memory:'
  storage: __dirname + '/sqlite3.db',

  // disable inserting undefined values as NULL
  // - default: false
  // omitNull: true,

  // a flag for using a native library or not.
  // in the case of 'pg' -- set this to true will allow SSL support
  // - default: false
  // native: true,

  // Specify options, which are used when sequelize.define is called.
  // The following example:
  //   define: { timestamps: false }
  // is basically the same as:
  //   sequelize.define(name, attributes, { timestamps: false })
  // so defining the timestamps for each model will be not necessary
  define: {
    underscored: false,
    freezeTableName: false,
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    },
    timestamps: false
  },

  // similar for sync: you can define this to always force sync for models
  sync: { force: true },

  // pool configuration used to pool database connections
  pool: {
    max: 5,
    idle: 30000,
    acquire: 60000,
  },
};


module.exports = {
  orm
};
