# Blih Brain Module Foundation Implementation

## Overview

The Brain module is Blih ERP's internal knowledge management system. It provides structured knowledge categories, versioned articles with full revision history, publication workflows with approval gating, and training material management. Every query is tenant-scoped by `businessId` and protected by `requireActiveModule('brain')`.

## Models

| Model | Table | Purpose |
|---|---|---|
| `KnowledgeCategory` | `brain_categories` | Hierarchical categories with self-referencing parent/child tree |
| `KnowledgeArticle` | `brain_articles` | Versioned articles with slug, visibility, and publication state |
| `KnowledgeRevision` | `brain_revisions` | Immutable revision snapshots created on every article update |
| `TrainingMaterial` | `brain_training_materials` | Documents, videos, presentations, and links for training |

## Article Lifecycle

```
draft → in_review → published → archived
  ↑                                 │
  └─────────── unpublish ───────────┘
```

Every article starts at `version: 1`. On creation, an initial `KnowledgeRevision` snapshot is stored. When `updateArticle` is called, version increments and a new revision row is created with `changeSummary` and full `contentSnapshot`. This provides a complete audit trail.

Slugs are auto-generated from the title (lowercased, hyphenated).

## Seeded Form Templates (6)

1. New Knowledge Article Submission Form
2. SOP Creation Form
3. Knowledge Revision Request Form
4. Internal Publication Approval Form
5. Training Material Submission Form
6. Knowledge Feedback Form

## API Endpoints

| Method | Route | Role Guard | Description |
|--------|-------|-----------|-------------|
| POST | `/api/brain/categories` | KNOWLEDGE_MANAGER, BUSINESS_ADMIN | Create category |
| GET | `/api/brain/categories` | Any authenticated | List categories with subcategories |
| POST | `/api/brain/articles` | Any authenticated | Create article (draft) |
| GET | `/api/brain/articles` | Any authenticated | List/search articles |
| GET | `/api/brain/articles/:id` | Any authenticated | Get article with revisions |
| PATCH | `/api/brain/articles/:id` | Any authenticated | Update article (creates revision) |
| PATCH | `/api/brain/articles/:id/publish` | KNOWLEDGE_MANAGER, BUSINESS_ADMIN | Publish article |
| PATCH | `/api/brain/articles/:id/unpublish` | KNOWLEDGE_MANAGER, BUSINESS_ADMIN | Revert to draft |
| PATCH | `/api/brain/articles/:id/submit-review` | Any authenticated | Submit for review, notifies approvers |
| POST | `/api/brain/training` | KNOWLEDGE_MANAGER, BUSINESS_ADMIN | Create training material |
| GET | `/api/brain/training` | Any authenticated | List training materials |

## Notifications

On `submit-review`, the service looks up all `KNOWLEDGE_MANAGER` users and sends each an `InternalNotifier` alert with the article title.

## Audit Logging

All writes log via `AuditLogService`: `CREATE_KB_CATEGORY`, `CREATE_KB_ARTICLE`, `UPDATE_KB_ARTICLE`, `PUBLISH_KB_ARTICLE`, `UNPUBLISH_KB_ARTICLE`, `SUBMIT_KB_REVIEW`, `CREATE_TRAINING_MATERIAL`.

## Files Created

- `src/models/KnowledgeCategory.ts`, `KnowledgeArticle.ts`, `KnowledgeRevision.ts`, `TrainingMaterial.ts`
- `src/modules/brain/brain.service.ts`, `brain.controller.ts`, `brain.routes.ts`
- `tests/brain.test.ts`

## Files Modified

- `src/models/index.ts` — registered 4 Brain models
- `src/models/Business.ts` — added hasMany for Brain models
- `src/models/User.ts` — added hasMany KnowledgeArticle + KnowledgeRevision
- `src/app.ts` — mounted `/api/brain`
- `src/modules/moduleTemplate/template.service.ts` — expanded brain forms from 2 to 6
