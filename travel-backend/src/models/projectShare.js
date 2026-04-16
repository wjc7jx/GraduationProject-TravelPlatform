import { DataTypes, Model } from 'sequelize';

export class ProjectShare extends Model {}

export function initProjectShare(sequelize) {
  ProjectShare.init(
    {
      share_id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      creator_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      view_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      is_revoked: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProjectShare',
      tableName: 'project_shares',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['project_id', 'created_at'] },
        { fields: ['creator_user_id', 'created_at'] },
        { fields: ['is_revoked', 'expires_at'] },
      ],
    }
  );

  return ProjectShare;
}