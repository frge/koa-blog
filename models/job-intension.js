module.exports = function (sequelize, DataTypes) {
  return sequelize.define('jobIntension', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    nature: {
      type: DataTypes.ENUM,
      values: ['全职', '兼职'],
      comment: '工作性质'
    },
    industry: {
      type: DataTypes.STRING,
      comment: '期望行业',
    },
    address: {
      type: DataTypes.STRING,
      comment: '目标地点',
    },
    salary: {
      type: DataTypes.STRING,
      comment: '期望薪资',
    },
    job: {
      type: DataTypes.STRING,
      comment: '目标职能',
    }
  }, {
    comment: '求职意向表',
    timestamps: true,
    updateAt: false,
  });
};
