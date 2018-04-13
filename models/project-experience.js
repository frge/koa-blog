module.exports = function (sequelize, DataTypes) {
  return sequelize.define('projectExperience', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '项目名称',
    },
    description: {
      type: DataTypes.TEXT,
      comment: '项目描述',
    },
    begin: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '开始时间'
    },
    end: {
      type: DataTypes.DATE,
      comment: '结束时间'
    },
    address: {
      type: DataTypes.STRING,
      comment: '项目地址'
    },
    url: {
      type: DataTypes.STRING,
      comment: '网络链接',
    },
    organization: {
      type: DataTypes.STRING,
      comment: '项目单位/组织'
    }
  }, {
    comment: '项目经历表',
    timestamps: false,
  });
};

