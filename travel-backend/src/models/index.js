import { sequelize, testConnection } from '../config/database.js';
import { initUser, User } from './user.js';
import { initProject, Project } from './project.js';
import { initContent, Content } from './content.js';
import { initLocation, Location } from './location.js';
import { initPermission, Permission } from './permission.js';
import { initFriendship, Friendship } from './friendship.js';
import { initInvitationCode, InvitationCode } from './invitationCode.js';
import { initProjectShare, ProjectShare } from './projectShare.js';

initUser(sequelize);
initProject(sequelize);
initContent(sequelize);
initLocation(sequelize);
initPermission(sequelize);
initFriendship(sequelize);
initInvitationCode(sequelize);
initProjectShare(sequelize);

// Associations
User.hasMany(Project, { foreignKey: 'user_id', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Project.hasMany(Content, { foreignKey: 'project_id', as: 'contents' });
Content.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Location.hasMany(Content, { foreignKey: 'location_id', as: 'contents' });
Content.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

User.hasMany(Friendship, { foreignKey: 'user_id', as: 'friendships' });
User.hasMany(Friendship, { foreignKey: 'friend_id', as: 'friendedBy' });
Friendship.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Friendship.belongsTo(User, { foreignKey: 'friend_id', as: 'friend' });

User.hasMany(InvitationCode, { foreignKey: 'creator_user_id', as: 'invitationCodes' });
InvitationCode.belongsTo(User, { foreignKey: 'creator_user_id', as: 'creator' });

Project.hasMany(ProjectShare, { foreignKey: 'project_id', as: 'shares' });
ProjectShare.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
User.hasMany(ProjectShare, { foreignKey: 'creator_user_id', as: 'projectShares' });
ProjectShare.belongsTo(User, { foreignKey: 'creator_user_id', as: 'shareCreator' });

export {
	sequelize,
	testConnection,
	User,
	Project,
	Content,
	Location,
	Permission,
	Friendship,
	InvitationCode,
	ProjectShare,
};
