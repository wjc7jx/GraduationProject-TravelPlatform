import { DataTypes, Model } from 'sequelize';

export class User extends Model {}

export function initUser(sequelize) {
  User.init(
    {
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      openid: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      nickname: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '旅行者',
      },
      avatar_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return User;
}
