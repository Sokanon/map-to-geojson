# Product Roadmap

## Current State (MVP)

- [x] Image upload (PNG, JPG, PDF)
- [x] Magic wand selection (boundary + tolerance modes)
- [x] AI OCR (Tesseract + Gemini)
- [x] Polygon vertex editing
- [x] Collections/grouping
- [x] GeoJSON/TopoJSON export
- [x] Docker deployment

## Phase 1: Commercial Ready

Priority features to charge money:

- [ ] **User authentication** — Basic login/signup
- [ ] **Project management** — Save/load projects, history
- [ ] **Georeferencing** — Place map on real-world coordinates (critical for GIS integration)
- [ ] **Batch processing** — Upload multiple pages, digitize in sequence
- [ ] **Undo/redo** — Essential for production use

## Phase 2: Growth Features

Features that increase stickiness and ARPU:

- [ ] **Team collaboration** — Shared projects, permissions
- [ ] **API access** — Programmatic magic-wand + OCR
- [ ] **Custom export templates** — CSV, Shapefile, DXF
- [ ] **Integration webhooks** — Push data to property management systems
- [ ] **Usage analytics** — Track digitization volume

## Phase 3: Enterprise

Features for larger contracts:

- [ ] **SSO/SAML** — Enterprise authentication
- [ ] **On-premise deployment** — Air-gapped environments
- [ ] **Audit logs** — Compliance requirements
- [ ] **Custom OCR training** — Domain-specific text recognition
- [ ] **SLA support** — Guaranteed response times

## Technical Debt to Address

- [ ] Add comprehensive error handling
- [ ] Write tests (currently 0 coverage)
- [ ] Add rate limiting for API
- [ ] Implement proper logging
- [ ] Set up CI/CD pipeline

## Pricing Tiers (Proposed)

| Tier | Price | Limits | Features |
|------|-------|--------|----------|
| Free | $0 | 5 projects, no API | Core digitization |
| Starter | $29/mo | 50 projects | + Georeferencing, batch |
| Pro | $79/mo | Unlimited | + API, integrations |
| Team | $149/mo | Unlimited + 5 seats | + Collaboration |
| Enterprise | Custom | Unlimited | + SSO, on-prem, SLA |
