import { DataTypes, Model } from 'sequelize';

export class Content extends Model {}

export function initContent(sequelize) {
  Content.init(
    {
      content_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      content_type: {
        type: DataTypes.ENUM('photo', 'note', 'audio', 'track'),
        allowNull: false,
      },
      content_data: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      record_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      location_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_deleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Content',
      tableName: 'contents',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['project_id'] },
        { fields: ['project_id', 'record_time'] },
        { fields: ['location_id'] },
        { fields: ['is_deleted'] },
      ],
    }
  );
  return Content;
}
