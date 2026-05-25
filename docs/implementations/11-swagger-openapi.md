# OpenAPI Implementation 

## Overview
A comprehensive structure converting inline schema bindings (`joi` equivalents alongside structural logic scopes) directly into generic `swagger-jsdoc` mappings accessible at runtime inside a self-hosted `swagger-ui-express` environment.

## 1. Engine Configuration (`config/swagger.ts`)
Creates standard definition parameters outlining basic OpenApi `3.0.0` elements capturing standard `responses` mappings ensuring we do not arbitrarily duplicate `4xx`/`5xx` strings across independent controllers natively:
```typescript
{
   components: {
      responses: {
        '400': { description: 'Bad Request - Validation or logic error' },
        '401': { description: 'Unauthorized - Missing or invalid Bearer Token' },
        ...
```

## 2. Dynamic Route Scraper (`annotate_swagger.js`)
Instead of locking users down strictly manually building out multi-line JSDocs inside 20 varying component matrices (`.routes.ts`), an internal macro scraped the actual file structures dynamically checking mapping structures directly into `$router.[method]`. Based off simple inferencing (`if .includes('listMine') then apply Page bounds limiters`) we were able to natively format full system documentation natively.

## 3. Boundary & Upload Awareness
By reading abstract logic bounds directly linked on endpoints mapping to `/api/files`, the mapping scripts inherently mapped schema forms dynamically pointing directly at `multipart/form-data` natively skipping over JSON formats that normal elements trigger automatically ensuring complete functional UI states.

## 4. UI Provisioning (`app.ts`)
Bound to `/api/docs` universally masking out standard Nginx wrappers safely exposing logical testing grounds straight towards Developers without polluting implicit business structures.
