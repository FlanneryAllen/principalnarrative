/**
 * Integration Routes Handler
 * Handles HTTP requests for harvest integrations
 */

const { handleIntegrationRequest } = require('./integrations');

/**
 * Check if a request is for integration endpoints
 */
function isIntegrationRoute(pathname) {
  return pathname.startsWith('/api/integrations') ||
         pathname.startsWith('/api/harvest/');
}

/**
 * Handle integration routes
 */
async function handleIntegrationRoutes(pathname, method, body, session, store) {
  // Check authentication for protected routes
  if (pathname.startsWith('/api/harvest/') && !session) {
    return {
      status: 401,
      data: { error: 'Authentication required' }
    };
  }

  try {
    // Pass the store for saving harvested units
    const result = await handleIntegrationRequest(pathname, method, body, store);

    return {
      status: result.success ? 200 : 400,
      data: result
    };
  } catch (error) {
    console.error(`[IntegrationRoutes] Error handling ${method} ${pathname}:`, error);

    return {
      status: 500,
      data: {
        success: false,
        error: error.message
      }
    };
  }
}

module.exports = {
  isIntegrationRoute,
  handleIntegrationRoutes
};