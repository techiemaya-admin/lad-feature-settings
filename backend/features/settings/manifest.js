/**
 * Feature Manifest
 * Module: backend/features/settings
 * Description: Registers the settings feature with the LAD backend platform
 */
module.exports = {
    name: 'settings',
    description: 'Tenant profile and configuration management',
    version: '1.0.0',
    routes: require('./routes')
};
