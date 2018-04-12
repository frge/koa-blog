module.exports = function (sequelize, DataTypes) {
  return sequelize.define('resume', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '语种名称',
    },
    proficiency: {
      type: DataTypes.INTEGER,
      validate: {min: 0, max: 100},
      allowNull: false,
      comment: '熟练程度'
    },
  }, {
    comment: '语言能力表',
    timestamps: false,
  });
};
