module.exports = function (sequelize, DataTypes) {
  sequelize.define('trainingExperience', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '受训时间'
    },
    agency: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '培训机构'
    },
    content: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '培训内容'
    }
  }, {
    comment: '培训记录',
    timestamps: false,
  })
};
