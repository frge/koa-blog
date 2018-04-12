module.exports = function (sequelize, DataTypes) {
  return sequelize.define('educationExperience', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '开始时间',
    },
    endTime: {
      type: DataTypes.DATE,
      comment: '结束时间',
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '主修领域'
    }
  }, {
    comment: '教育经历表',
    timestamps: false,
  });
};
