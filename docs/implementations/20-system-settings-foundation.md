# Blih System Settings & Branding Foundation

## Overview

The Settings and Branding module establishes central identity and configuration mapping for individual Blih ERP tenants. It separates global system constraints (like Module Licensing boundaries) from aesthetic and localization user overrides ensuring platform integrity overhead while remaining fully customizable for individual clients.

## Models

| Model | Table | Purpose |
|---|---|---|
| `BusinessSetting` | `business_settings` | Granular arbitrary key/value store mappings tracking boolean configs or structural adjustments. |
| `BusinessBranding` | `business_branding` | The singleton aesthetic definition outlining structural CSS/Interface variables enabling White-labeling. |
| `BusinessLocalization` | `business_localizations` | Holds singleton temporal and locational formats guaranteeing correct Date parsing and tax rendering globally. |

## Data Rules & Security Boundaries

1. **Strict Key Deny-Listing:**
   A system setting (`BusinessSetting`) is universally mutable by Business Admins. However, to prevent overriding of parent pricing limits, `SettingsService` hard blocks any attempts to upsert `["plan", "subscription", "modules", "features"]` keys natively. Subscriptions remain isolated from generic configs.

2. **Public Payload Exposure:**
   The route `/api/settings/public` operates independently by returning exactly 1. the singleton `BusinessBranding`, 2. the singleton `BusinessLocalization`, and 3. only `BusinessSetting` elements statically flagged as `isPublic: true`. This permits unauthenticated loading of the frontend Login interface strictly mapping to white-labelled CSS overrides without leaking raw configurations.

## Exposed Routines

| Route | Execution Flow | Access Requirement |
|---|---|---|
| `GET /api/settings/public`| Resolves aesthetic payload globally | Open (requires explicit `businessId` query parameter) |
| `PATCH /api/settings/branding`| Upserts new visual aesthetic variables | `BUSINESS_ADMIN` |
| `PATCH /api/settings/localization`| Modifies timezone and format configurations | `BUSINESS_ADMIN` |
| `POST /api/settings`| Injects or mutates generic setting hash map | `BUSINESS_ADMIN` |
| `GET /api/settings`| Retrieves hash array mapped strictly against business scope | `BUSINESS_ADMIN` |

## Extensibility Parameters
- **Asset Interlink**: Branding definitions include `logoFileId` and `faviconFileId` holding a direct UUID link across to the `FileAsset` model ensuring media uploads adhere to existing limits mapping against Storage quotas inherently.

## Audit Logs Tracking
Since configurations heavily govern behavior logic layout throughout the ERP, setting adjustments hook completely into `AuditLogService` logging mutations on:
- `UPDATE_BRANDING`
- `UPDATE_LOCALIZATION`
- `UPDATE_SETTING`
- `DELETE_SETTING`
