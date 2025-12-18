# API Path Mapping - Frontend ↔ Backend

This document maps frontend API calls to backend routes, identifying mismatches and required fixes.

## Legend

- ✅ **Match**: Frontend and backend paths match and work correctly
- ⚠️ **Partial**: Path exists but might have different parameter format
- ❌ **Mismatch**: Frontend expects path that doesn't exist in backend
- 🔄 **Needs Update**: Frontend should use different backend path

---

## Authentication APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `POST /login` | `POST /api/app_qy_v1/login` | ✅ | Working |
| `POST /register` | `POST /api/app_qy_v1/register` | ✅ | Working |
| `POST /logout` | `POST /api/app_qy_v1/logout` | ✅ | Working |
| `GET /user` | `GET /api/app_qy_v1/user` | ✅ | Working |

**File**: `services/ApiCenter.ts` (lines 201-243)
**Backend**: `routes/AppQyV1Router/AppQyV1Auth.php`

---

## User Profile APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `GET /user/profile` | `GET /api/app_qy_v1/user/profile` | ✅ | Working |
| `PUT /user/profile` | `PUT /api/app_qy_v1/user/profile` | ✅ | Working |
| `POST /user/avatar` | `POST /api/app_qy_v1/user/avatar` | ✅ | Working |
| `GET /settings` | ❌ Not implemented | ❌ | Backend doesn't have this endpoint |
| `PUT /settings` | ❌ Not implemented | ❌ | Backend doesn't have this endpoint |

**File**: `services/ApiCenter.ts` (lines 250-301)
**Backend**: `routes/AppQyV1Router/AppQyV1User.php`

**Fix Required**:
- Backend needs `/user/settings` endpoint
- Or frontend should use local SettingsCenter only

---

## Word Group APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `GET /word-groups` | ❌ Not found | ❌ | Frontend expects this |
| `GET /word-groups/{id}` | ❌ Not found | ❌ | Frontend expects this |
| `GET /word-groups/{id}/words` | ❌ Not found | ❌ | Frontend expects this |
| `POST /word-groups` | ❌ Not found | ❌ | Frontend expects this |
| `DELETE /word-groups/{id}` | ❌ Not found | ❌ | Frontend expects this |
| | `GET /api/app_qy_v1/query_all_groups` | 🔄 | Backend provides this |
| | `GET /api/app_qy_v1/query_group_by_gid` | 🔄 | Backend provides this |
| | `GET /api/app_qy_v1/query_gwords` | 🔄 | Backend provides this |

**File**: `services/ApiCenter.ts` (lines 307-380)
**Backend**: `routes/AppQyV1Router/AppQyV1Dict.php`

**Fix Required**:
- Option 1: Update frontend to use backend routes (`query_all_groups`, `query_group_by_gid`, `query_gwords`)
- Option 2: Add backend aliases: `/word-groups` → `/query_all_groups`

---

## Word/Dictionary APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `GET /words/{id}` | `GET /api/app_qy_v1/words/{id}` | ⚠️ | Requires auth:sanctum |
| `POST /words` | `POST /api/app_qy_v1/words` | ⚠️ | Requires auth:sanctum |
| `PUT /words/{id}` | `PUT /api/app_qy_v1/words/{id}` | ⚠️ | Requires auth:sanctum |
| `DELETE /words/{id}` | `DELETE /api/app_qy_v1/words/{id}` | ⚠️ | Requires auth:sanctum |
| `GET /words/search` | ❌ Not found | ❌ | Frontend expects this |
| `GET /words/translate` | ❌ Not found | ❌ | Frontend expects this |
| `GET /dictionary/{lang}/{word}` | ❌ Not found | ❌ | Frontend expects this |
| `GET /dictionary/languages` | ❌ Not found | ❌ | Frontend expects this |
| | `GET /api/app_qy_v1/query_word` | 🔄 | Backend provides this |
| | `POST /api/app_qy_v1/query_translation` | 🔄 | Backend provides this |

**File**: `services/ApiCenter.ts` (lines 386-455)
**Backend**: `routes/AppQyV1Router/AppQyV1Words.php`, `AppQyV1Dict.php`

**Fix Required**:
- Map `/words/search` → `/query_word`
- Map `/words/translate` → `/query_translation`
- Implement dictionary endpoints or update frontend

---

## Learning Progress APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `GET /learning/stats` | `GET /api/app_qy_v1/learning/stats` | ✅ | Working |
| `GET /learning/progress` | `GET /api/app_qy_v1/learning/progress` | ✅ | Working |
| `POST /learning/progress` | `POST /api/app_qy_v1/learning/progress` | ✅ | Working |
| `GET /learning/review-queue` | ❌ Not found | ❌ | Frontend expects this |
| | `GET /api/app_qy_v1/learning/libraries` | 🔄 | Backend provides, unused |

**File**: `services/ApiCenter.ts` (lines 461-491)
**Backend**: `routes/AppQyV1Router/AppQyV1Learning.php`

**Fix Required**:
- Implement `/learning/review-queue` or update frontend

---

## Quiz APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `POST /quiz/generate` | ❌ Not found | ❌ | Frontend expects this |
| `POST /quiz/submit` | ❌ Not found | ❌ | Frontend expects this |
| `GET /quiz/history` | ❌ Not found | ❌ | Frontend expects this |

**File**: `services/ApiCenter.ts` (lines 497-529)
**Backend**: No quiz routes found

**Fix Required**:
- Implement quiz system in backend
- Or remove quiz features from frontend

---

## System APIs

| Frontend Call | Backend Route | Status | Notes |
|--------------|---------------|--------|-------|
| `GET /system/supported-languages` | `GET /api/app_qy_v1/system/supported-languages` | ✅ | Working |
| | `GET /api/app_qy_v1/system/stats` | 🔄 | Backend provides, unused |

**File**: `services/api.ts` (line 107)
**Backend**: `routes/AppQyV1Router/AppQyV1System.php`

---

## File Access APIs

| Frontend Expectation | Backend Route | Status | Notes |
|---------------------|---------------|--------|-------|
| `GET /files/avatars/{app}/{filename}` | `GET /api/files/avatars/{app}/{filename}` | ✅ | Working via FileController |
| `GET /files/uploads/{app}/{filename}` | `GET /api/files/uploads/{app}/{filename}` | ✅ | Working via FileController |
| `GET /files/static/{app}/{filename}` | `GET /api/files/static/{app}/{filename}` | ✅ | Working via FileController |

**Backend**: `routes/files.php`, `app/Http/Controllers/FileController.php`

---

## Summary Statistics

### ✅ Working Endpoints: 12
- Authentication (4): login, register, logout, user
- User Profile (3): profile GET/PUT, avatar POST
- Learning (3): stats, progress GET/POST
- System (1): supported-languages
- Files (3): avatars, uploads, static

### ❌ Missing Endpoints: 14
- Word Groups (5): CRUD operations
- Dictionary (4): search, translate, dictionary lookup
- Quiz (3): generate, submit, history
- Learning (1): review-queue
- User (1): settings

### 🔄 Backend Routes Not Used by Frontend: 6
- `/query_all_groups`, `/query_group_by_gid`, `/query_gwords`
- `/query_word`, `/query_translation`
- `/learning/libraries`
- `/vocabulary/libraries`
- `/system/stats`

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)

1. **Word Groups** - Map frontend calls to backend routes:
   ```typescript
   // Update ApiCenter.ts
   getWordGroups() → '/query_all_groups'
   getWordGroup(id) → '/query_group_by_gid?gid={id}'
   getGroupWords(id) → '/query_gwords?gid={id}'
   ```

2. **Dictionary/Translation** - Map frontend calls:
   ```typescript
   // Update ApiCenter.ts
   searchWord(keyword) → '/query_word?word={keyword}'
   translateWord(word, from, to) → '/query_translation' (POST)
   ```

### Phase 2: Medium Priority

3. **Vocabulary Libraries** - Use existing backend endpoints:
   ```typescript
   // Add to ApiCenter.ts
   getVocabularyLibraries() → '/vocabulary/libraries'
   getLearningLibraries() → '/learning/libraries'
   ```

4. **Settings** - Decision needed:
   - Keep settings client-side only (current SettingsCenter)
   - Or implement backend `/user/settings` endpoint

### Phase 3: Future Enhancements

5. **Quiz System** - Implement backend endpoints:
   - `POST /quiz/generate`
   - `POST /quiz/submit`
   - `GET /quiz/history`

6. **Review Queue** - Implement backend endpoint:
   - `GET /learning/review-queue`

---

## Migration Guide

### For Developers

When updating API calls:

1. **Check this mapping table first**
2. **Update ApiCenter.ts** - Change endpoint path
3. **Update types.ts** - Ensure response types match backend
4. **Test with real backend** - Verify data structure
5. **Update mock data** - Match backend response format

### Example Migration

```typescript
// Before
async getWordGroups() {
  return this.request<WordGroup[]>('/word-groups');
}

// After
async getWordGroups() {
  const response = await this.request<any>('/query_all_groups');
  // Transform backend format to WordGroup[] if needed
  return response.map(transformToWordGroup);
}
```

---

## Notes

- All backend routes require `/api/app_qy_v1` prefix
- Some routes require `auth:sanctum` middleware
- Frontend currently uses mock data fallback for missing endpoints
- Backend uses different naming convention (snake_case vs kebab-case)

**Last Updated**: 2025-12-17
**Maintained by**: Development Team
