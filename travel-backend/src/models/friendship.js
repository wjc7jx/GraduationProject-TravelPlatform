import { DataTypes, Model } from 'sequelize';

export class Friendship extends Model {}

export function initFriendship(sequelize) {
  Friendship.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      friend_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      remark: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Friendship',
      tableName: 'friendships',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { unique: true, fields: ['user_id', 'friend_id'] },
        { fields: ['user_id'] },
        { fields: ['friend_id'] },
      ],
    }
  );
  return Friendship;
}
