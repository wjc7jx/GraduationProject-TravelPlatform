import { DataTypes, Model } from 'sequelize';

export class Permission extends Model {}

export function initPermission(sequelize) {
  Permission.init(
    {
      permission_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      target_type: {
        type: DataTypes.ENUM('project', 'content'),
        allowNull: false,
      },
      target_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      visibility: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      white_list: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Permission',
      tableName: 'permissions',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { unique: true, fields: ['target_type', 'target_id'] },
        { fields: ['visibility'] },
      ],
    }
  );
  return Permission;
}
