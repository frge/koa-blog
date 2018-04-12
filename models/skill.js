module.exports = function (sequelize, DataTypes) {
  return sequelize.define('skill', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '技能名称'
    },
    proficiency: {
      type: DataTypes.INTEGER,
      validate: {min: 0, max: 100},
      allowNull: false,
      comment: '熟练程度'
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '使用时长'
    }
  }, {
    comment: '技能表',
    timestamps: false,
  });
};
