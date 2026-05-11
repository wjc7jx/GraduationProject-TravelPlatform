import { DataTypes, Model } from 'sequelize';

export class Project extends Model {}

export function initProject(sequelize) {
  Project.init(
    {
      project_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      subtitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      cover_image: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      tags: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      is_pinned: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      pinned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_archived: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      review_status: {
        type: DataTypes.ENUM('ok', 'pending', 'flagged'),
        allowNull: false,
        defaultValue: 'ok',
      },
      review_reason: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      review_checked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Project',
      tableName: 'projects',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'updated_at'] },
        { fields: ['user_id', 'is_pinned', 'pinned_at'] },
        { fields: ['user_id', 'is_archived'] },
        { name: 'idx_projects_review_status', fields: ['review_status'] },
      ],
    }
  );
  return Project;
}
