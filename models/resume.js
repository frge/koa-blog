module.exports = function (sequelize, DataTypes) {
  return sequelize.define('resume', {
    id: {
      // todo 使用用户的ID作为主键
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      comment: '姓名'
    },
    address: {
      type: DataTypes.STRING,
      comment: '现居地'
    },
    birthplace: {
      type: DataTypes.STRING,
      comment: '籍贯',
    },
    monthly: {
      type: DataTypes.STRING,
      comment: '当前月薪',
    },
    selfAssessment: {
      type: DataTypes.TEXT,
      comment: '自我评价',
    },
    extra: {
      type: DataTypes.TEXT,
      comment: '附加信息',
    }
  }, {
    comment: '教育经历表',
    timestamps: false,
  });
};
