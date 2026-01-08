/**
 * API Router - Automatically routes requests to the correct backend based on path
 * 
 * Production URLs:
 * - Backend (main): https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev/
 * - Backend-Ops: https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev/
 * 
 * Local Development:
 * - Backend (main): http://localhost:3000/dev (from VITE_API_BASE_URL)
 * - Backend-Ops: http://localhost:3005/dev (from VITE_OPS_API_BASE_URL)
 */

// Detect if we're in production (check if we're not on localhost)
// Production: CloudFront (dwodlititlpa1.cloudfront.net) or any non-localhost domain
const isProduction = typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('127.0.0.1') &&
  window.location.protocol === 'https:';

// Production base URLs
const PROD_BACKEND_BASE = 'https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev';
const PROD_BACKEND_OPS_BASE = 'https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev';

// Local development base URLs (from env vars or defaults)
const LOCAL_BACKEND_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/dev';
const LOCAL_BACKEND_OPS_BASE = import.meta.env.VITE_OPS_API_BASE_URL || 'http://localhost:3005/dev';

// Select base URLs based on environment
const BACKEND_BASE = isProduction ? PROD_BACKEND_BASE : LOCAL_BACKEND_BASE;
const BACKEND_OPS_BASE = isProduction ? PROD_BACKEND_OPS_BASE : LOCAL_BACKEND_OPS_BASE;

/**
 * Resolves the full API URL for a given path
 * Routes to backend-ops for lab, workflow, and related endpoints
 * Routes to backend (main) for all other endpoints
 * 
 * @param path - The API path (e.g., '/lab-reports/123' or '/users')
 * @returns The full URL including the appropriate base URL
 */
export function resolveApiUrl(path: string): string {
  // Normalize path (ensure it starts with /)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Routes that go to backend-ops
  const backendOpsRoutes = [
    '/lab-reports',
    '/lab',
    '/workflow',
    '/unified-lab-reports',
    '/pending-csv-uploads',
    '/lab-requests',
    '/lab-tests',
    '/anomalies',
    '/contacts',
    '/users',
    '/assignments',
  ];
  
  // Check if path matches any backend-ops route prefix
  const shouldRouteToOps = backendOpsRoutes.some(route => 
    normalizedPath.startsWith(route)
  );
  
  // Select the appropriate base URL
  const baseUrl = shouldRouteToOps ? BACKEND_OPS_BASE : BACKEND_BASE;
  
  // Concatenate base URL with path (ensure no double slashes)
  const baseUrlClean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const pathClean = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  
  const fullUrl = `${baseUrlClean}${pathClean}`;
  
  // Log routing decision (always log for debugging, but more verbose in development)
  if (isProduction) {
    // Minimal logging in production (only first few requests to avoid spam)
    if (!(window as any).__apiRouterLogged) {
      console.log('[API Router] Production mode - Routing enabled', {
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        backendBase: BACKEND_BASE,
        backendOpsBase: BACKEND_OPS_BASE
      });
      (window as any).__apiRouterLogged = true;
    }
  } else {
    // Detailed logging in development
    console.log('[API Router]', {
      path: normalizedPath,
      routedTo: shouldRouteToOps ? 'backend-ops' : 'backend',
      baseUrl,
      fullUrl
    });
  }
  
  return fullUrl;
}
