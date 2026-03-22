import { sequelize, testConnection } from '../config/database.js';
import { initUser, User } from './user.js';
import { initProject, Project } from './project.js';
import { initContent, Content } from './content.js';
import { initLocation, Location } from './location.js';
import { initPermission, Permission } from './permission.js';

initUser(sequelize);
initProject(sequelize);
initContent(sequelize);
initLocation(sequelize);
initPermission(sequelize);

// Associations
User.hasMany(Project, { foreignKey: 'user_id', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Project.hasMany(Content, { foreignKey: 'project_id', as: 'contents' });
Content.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Location.hasMany(Content, { foreignKey: 'location_id', as: 'contents' });
Content.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

export { sequelize, testConnection, User, Project, Content, Location, Permission };
