// 获奖记录

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('award', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    issued: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '获奖时间',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '奖项名称',
    },
    level: {
      type: DataTypes.ENUM,
      values: [1, 2, 3],
      comment: '获奖级别：1->省级，2->国家大奖，3->国际大奖',
    },
    org: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '颁奖组织',
    },
    resumeId: {
      type: DataTypes.BIGINT,
      references: {
        model: '',
        key: 'id',//
      }
    }
  }, {
    comment: '获奖记录表',
    timestamps: false,
  });
};
