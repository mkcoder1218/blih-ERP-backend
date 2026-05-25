# Blih CRM Module Foundation

## Overview

The Customer Relationship Management module manages the end-to-end sales lifecycle mapping organic inbound requests seamlessly transferring structural identities dynamically (Lead -> Deal -> Client). Centralizing all communication into singular `Interaction` pools while tracking formal quote definitions inside abstract `Proposal` records.

## Core Models

| Model | Table | Execution Role |
|---|---|---|
| `Lead` | `crm_leads` | Tracks explicit introductory details binding internal handlers (`assignedToUserId`) managing initial outreach patterns dynamically. |
| `Deal` | `crm_deals` | Abstracts quantitative values (Value, Currency, Expected Close) organizing pipeline bounds filtering specifically to internal Sales Reps mapping standard statuses. |
| `Proposal` | `crm_proposals` | Isolates explicit Document / Pricing mappings natively referencing `FileAsset` payloads without exposing intermediate negotiation fields heavily. |
| `Client` | `crm_clients` | Terminal mapping binding abstract won business logic natively into long-term `Account Manager` supervision paths tracking metadata/billing structurally. |
| `Interaction` | `crm_interactions` | Centralized unified action logging explicitly bridging all historical contexts ensuring audit trails remain dense and searchable naturally. |

## Protective Workflows

**1. Public Data Injection limits:**
The `publicCreateLead` API natively bounds endpoint connections creating explicit `safeData` drops completely mapping around payload modifications preventing public users from sending `{ stage: "qualified" }`. Un-authenticated sources structurally route to `"new"`.

**2. Stage Manipulation Logic:**
Explicitly modifying `Lead.stage` mappings bounds securely over `Interaction` logging entirely. `crm.service.updateLead()` implicitly deletes incoming `.stage` overrides to ensure managers natively trace the reason behind a transition through formal logged conversations seamlessly validating stage jumps internally.

**3. Conversion Trees:**
Standardized conversions run sequentially transferring identifiers explicitly converting strings and statuses organically:
`Lead (Qualified)` -> `Deal (Discovery | Won)` -> `Client (Active)`. Mapped references cross-bind ensuring tracing traces backward flawlessly without duplicated entries over the primary tables natively.
