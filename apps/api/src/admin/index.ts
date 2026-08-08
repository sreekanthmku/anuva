/**
 * Admin API module — separate `/admin` surface with its own auth,
 * validation, services, and repositories.
 *
 * Architecture: Routes → Controllers → Services → Repositories
 */

export { createAdminRouter, type AdminDeps } from './routes/index.js';
export { AdminAuthService } from './services/auth.service.js';
export { EntityService } from './services/entity.service.js';
export { ADMIN_ENTITIES, getEntityByResource, listEntityMeta } from './entities/registry.js';
export {
  getAdminPassword,
  getAdminSessionSecret,
  getAdminSessionTtlHours,
  isAdminAuthConfigured,
} from './config.js';

