// 教育经历
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('socialPractice', {
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '名称'
    },
    content: {
      type: DataTypes.STRING,
      comment: '内容'
    },
    job: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
    }
  }, {
    comment: '社会实践表',
    timestamps: false,
  });
};
