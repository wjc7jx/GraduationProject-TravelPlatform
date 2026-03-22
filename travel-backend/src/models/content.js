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
        type: DataTypes.STRING(20),
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
    },
    {
      sequelize,
      modelName: 'Content',
      tableName: 'contents',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );
  return Content;
}
