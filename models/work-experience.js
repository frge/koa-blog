
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('workExperience', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    begin: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '开始时间',
    },
    end: {
      type: DataTypes.DATE,
      comment: '结束时间',
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '所属行业',
    },
    position: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '任职岗位'
    },
    description: {
      type: DataTypes.TEXT,
      comment: '附加信息'
    }
  }, {
    comment: '工作经验表',
    timestamps: false,
  });
};
