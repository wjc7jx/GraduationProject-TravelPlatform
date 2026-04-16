import { DataTypes, Model } from 'sequelize';

export class InvitationCode extends Model {}

export function initInvitationCode(sequelize) {
  InvitationCode.init(
    {
      invitation_code_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      creator_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      max_uses: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      used_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      expires_at: {
        type: DataTypes.DATE,
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
      modelName: 'InvitationCode',
      tableName: 'invitation_codes',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { unique: true, fields: ['code'] },
        { fields: ['creator_user_id', 'created_at'] },
        { fields: ['status', 'expires_at'] },
      ],
    }
  );
  return InvitationCode;
}