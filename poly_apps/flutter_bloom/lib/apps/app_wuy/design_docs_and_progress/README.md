# Design Docs & Progress - app_wuy

**App name**: app_wuy
**Created**: 2025-11-19
**Last updated**: 2025-11-19

## Directory Structure

```
design_docs_and_progress/
├── README.md                   # This file
├── 1_concept_designs/          # Level 1: concept diagrams
├── 2_page_designs_cn/          # Level 2: rough page designs (Chinese names)
├── 3_page_designs_en/          # Level 3: detailed page designs (English names)
├── backend_bridge/             # Backend integration docs
├── feature_progress/           # Feature progress tracking
├── flows/                      # Flow diagrams
├── progress_logs/              # Progress logs
└── wireframes/                 # Wireframes
```

## Three-Level Design Documentation

### Level 1: Concept diagrams (`1_concept_designs/`)
- **Purpose**: High-level concepts and overall architecture
- **Content**: Architecture diagrams, user flows, data models

### Level 2: Rough page designs (`2_page_designs_cn/`)
- **Purpose**: Page-level design (Chinese naming)
- **Content**: Page features, layout sketches, interaction notes

### Level 3: Detailed page designs (`3_page_designs_en/`)
- **Purpose**: Detailed design (English names aligned with code)
- **Content**: `pageview_map.json`, detailed specs

## Workflow

1. **Concept phase**: Write architecture in `1_concept_designs/`
2. **Page design**: Design pages in `2_page_designs_cn/` (Chinese names)
3. **Detail implementation**: Create detailed designs in `3_page_designs_en/`
4. **Development**: Implement components from `pageview_map.json`

## References

See `doc/DESIGN_DOCS_STRUCTURE.md` for the full guide.
