const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const appTs = fs.readFileSync(path.join(cwd, 'src/app.ts'), 'utf8');

// Detect the API prefix from app.ts (e.g. /api/v1)
const apiPrefix = '/api/v1';

// Parse route mounts from both app.use and apiRouter.use
const mounts = {};
appTs.split('\n').forEach(line => {
  // Match: apiRouter.use("/hr", hrRoutes)  OR  app.use("/hr", hrRoutes)
  const m = line.match(/(?:apiRouter|app)\.use\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)\s*\)/);
  if (m) {
    const mountPath = m[1];
    const routeVar = m[2];
    // Build full path: apiRouter mounts get the apiPrefix prepended
    if (line.includes('apiRouter')) {
      mounts[routeVar] = apiPrefix + mountPath;
    } else {
      mounts[routeVar] = mountPath;
    }
  }
});

console.log('Detected mounts:', mounts);

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) walk(path.join(dir, file), fileList);
    else if (file.endsWith('.routes.ts')) fileList.push(path.join(dir, file));
  }
  return fileList;
}

const routeFiles = walk(path.join(cwd, 'src/modules'));

routeFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // First, strip all existing @openapi annotation blocks to avoid duplicates
  content = content.replace(/\/\*\*\s*\n\s*\*\s*@openapi[\s\S]*?\*\/\s*\n/g, '');

  let lines = content.split('\n');

  // Find all exported route variable names from this file
  const exportMatches = [...content.matchAll(/export\s+(?:const|{)\s*(\w+(?:Routes?\w*))/g)];
  if (exportMatches.length === 0) return;

  // Build a lookup of which variable names map to mount paths
  const fileRouteMounts = {};
  for (const em of exportMatches) {
    const routeVar = em[1];
    if (mounts[routeVar]) {
      fileRouteMounts[routeVar] = mounts[routeVar];
    }
  }

  // If none of the exports map to a known mount, try the first export as the primary
  let primaryMount = null;
  for (const em of exportMatches) {
    if (mounts[em[1]]) {
      primaryMount = mounts[em[1]];
      break;
    }
  }
  if (!primaryMount) return;

  // Now annotate each router.METHOD() line
  let newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/router\.(get|post|put|patch|delete)\(\s*['"](.*?)['"]/);

    if (match && i > 0 && !lines[i-1].includes('*/')) {
      const method = match[1].toLowerCase();
      const routePath = match[2];

      let fullPath = primaryMount + (routePath === '/' ? '' : routePath);
      fullPath = fullPath.replace(/:([\w]+)/g, '{$1}');

      const pathParams = fullPath.match(/\{(\w+)\}/g) || [];

      // Derive tag from the mount path
      const tag = primaryMount.split('/').filter(Boolean).pop() || 'default';

      newLines.push(`/**`);
      newLines.push(` * @openapi`);
      newLines.push(` * ${fullPath}:`);
      newLines.push(` *   ${method}:`);
      newLines.push(` *     tags: [${tag}]`);
      newLines.push(` *     summary: ${method.toUpperCase()} ${routePath === '/' ? 'index' : routePath}`);
      newLines.push(` *     security:`);
      newLines.push(` *       - bearerAuth: []`);

      if (pathParams.length > 0) {
        newLines.push(` *     parameters:`);
        pathParams.forEach(p => {
          const pName = p.replace('{','').replace('}','');
          newLines.push(` *       - in: path`);
          newLines.push(` *         name: ${pName}`);
          newLines.push(` *         required: true`);
          newLines.push(` *         schema:`);
          newLines.push(` *           type: string`);
        });
      }

      // Pagination inference for list endpoints
      if (method === 'get' && (line.includes('.list') || line.includes('listMine') || line.includes('listAll'))) {
        if (pathParams.length === 0) newLines.push(` *     parameters:`);
        newLines.push(` *       - in: query`);
        newLines.push(` *         name: page`);
        newLines.push(` *         schema:`);
        newLines.push(` *           type: integer`);
        newLines.push(` *       - in: query`);
        newLines.push(` *         name: size`);
        newLines.push(` *         schema:`);
        newLines.push(` *           type: integer`);
      }

      newLines.push(` *     responses:`);
      newLines.push(` *       200:`);
      newLines.push(` *         description: Success`);
      newLines.push(` *       400:`);
      newLines.push(` *         $ref: '#/components/responses/400'`);
      newLines.push(` *       401:`);
      newLines.push(` *         $ref: '#/components/responses/401'`);
      newLines.push(` *       403:`);
      newLines.push(` *         $ref: '#/components/responses/403'`);
      newLines.push(` *       404:`);
      newLines.push(` *         $ref: '#/components/responses/404'`);
      newLines.push(` *       500:`);
      newLines.push(` *         $ref: '#/components/responses/500'`);
      newLines.push(` */`);
    }
    newLines.push(line);
  }
  fs.writeFileSync(file, newLines.join('\n'));
});

console.log('Swagger annotations injected successfully.');
