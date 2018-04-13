module.exports = function (sequelize, DataTypes) {
  return sequelize.define('certificate', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '证书名称',
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '获证时间',
    }
  }, {
    comment: '用户证书表',
    timestamps: false,
  });
};
