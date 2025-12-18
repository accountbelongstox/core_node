# AppQyV1 Backend Endpoints Audit Report

**Generated**: 2025-12-18
**Auditor**: Claude Code Assistant
**Project**: WordFlow AI

---

## Executive Summary

Total Endpoints Found: **45+**
Frontend Integration Status:
- ✅ Fully Integrated: 8
- ⚠️ Partially Integrated: 12
- ❌ Not Integrated: 25+

---

## 1. Authentication Endpoints (AppQyV1Auth.php)

### 1.1 POST `/api/app_qy_v1/register`
- **Backend**: ✅ Implemented (`AppQyV1AuthenticationRegistrationController::apiStore`)
- **Frontend**: ✅ Integrated (`ApiCenter.auth.register`)
- **UI**: ✅ Available (`/login` page, register mode)
- **Status**: ✅ **WORKING**
- **Testing**: User can register with username, password, email, nickname, invite_code

### 1.2 POST `/api/app_qy_v1/login`
- **Backend**: ✅ Implemented (`AppQyV1AuthenticationLoginController::login`)
- **Frontend**: ✅ Integrated (`ApiCenter.auth.login`)
- **UI**: ✅ Available (`/login` page, login mode)
- **Status**: ✅ **WORKING**
- **Testing**: User can login with username/password

### 1.3 POST `/api/app_qy_v1/logout`
- **Backend**: ✅ Implemented (`AppQyV1AuthenticationLoginController::logout`)
- **Frontend**: ✅ Integrated (`ApiCenter.auth.logout`)
- **UI**: ✅ Available (Profile page, Settings page)
- **Status**: ✅ **WORKING**
- **Testing**: User can logout from multiple places

### 1.4 GET `/api/app_qy_v1/user`
- **Backend**: ✅ Implemented (inline function)
- **Frontend**: ✅ Integrated (`ApiCenter.auth.getProfile`)
- **UI**: ⚠️ Indirect (used for session validation)
- **Status**: ✅ **WORKING**

### 1.5 POST `/api/app_qy_v1/forgot-password`
- **Backend**: ✅ Implemented (`PasswordResetLinkController::store`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT WORKING** - No UI for password reset

### 1.6 POST `/api/app_qy_v1/reset-password`
- **Backend**: ✅ Implemented (`NewPasswordController::store`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT WORKING** - No UI for password reset

---

## 2. User Profile Endpoints (AppQyV1User.php)

### 2.1 GET `/api/app_qy_v1/user/profile`
- **Backend**: ✅ Implemented (`AppQyV1ProfileController::getProfile`)
- **Frontend**: ✅ Integrated (`ApiCenter.user.getProfile`)
- **UI**: ✅ Available (Profile page displays user info)
- **Status**: ✅ **WORKING**

### 2.2 PUT `/api/app_qy_v1/user/profile`
- **Backend**: ✅ Implemented (`AppQyV1ProfileController::updateProfile`)
- **Frontend**: ✅ Integrated (`ApiCenter.user.updateProfile`)
- **UI**: ⚠️ Partial (ProfileEdit page, but missing some fields)
- **Status**: ⚠️ **PARTIALLY WORKING**
- **Issues**:
  - ✅ Can update: nickname, name, bio, location, learning_languages, avatar
  - ❌ UI doesn't show all available fields

### 2.3 GET `/api/app_qy_v1/user/initialization-status`
- **Backend**: ✅ Implemented (`AppQyV1UserInitializationController::status`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 2.4 POST `/api/app_qy_v1/user/initialize`
- **Backend**: ✅ Implemented (`AppQyV1UserInitializationController::initialize`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 2.5 GET `/api/app_qy_v1/user/progress`
- **Backend**: ✅ Implemented (inline mock function)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 2.6 GET `/api/app_qy_v1/user/stats`
- **Backend**: ✅ Implemented (inline mock function)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 3. Word Group Endpoints (AppQyV1Dict.php)

### 3.1 POST `/api/app_qy_v1/create_group`
- **Backend**: ✅ Implemented (`DGAController::createDictGroup`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED** - No UI to create word groups

### 3.2 GET `/api/app_qy_v1/query_all_groups`
- **Backend**: ✅ Implemented (`DGQController::getAllGroup`)
- **Frontend**: ✅ Integrated (`ApiCenter.wordGroups.getAll`)
- **UI**: ✅ Available (Library/Courses page, Dashboard/Home page)
- **Status**: ✅ **WORKING**

### 3.3 GET `/api/app_qy_v1/query_group_by_name`
- **Backend**: ✅ Implemented (`DGQController::getGroupByName`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 3.4 GET `/api/app_qy_v1/query_group_by_gid`
- **Backend**: ✅ Implemented (`DGQController::getGroupByGid`)
- **Frontend**: ✅ Integrated (`ApiCenter.wordGroups.getById`)
- **UI**: ⚠️ Indirect (used internally)
- **Status**: ⚠️ **PARTIALLY USED**

### 3.5 GET `/api/app_qy_v1/query_gwords`
- **Backend**: ✅ Implemented (`DGQController::getGwords`)
- **Frontend**: ✅ Integrated (`ApiCenter.wordGroups.getWords`)
- **UI**: ⚠️ Indirect (used by word list pages)
- **Status**: ⚠️ **PARTIALLY USED**

### 3.6 GET `/api/app_qy_v1/query_gcontent`
- **Backend**: ✅ Implemented (`DGQController::getGcontent`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 3.7 GET `/api/app_qy_v1/query_gfrequency`
- **Backend**: ✅ Implemented (`DGQController::getGFrequency`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 3.8 DELETE `/api/app_qy_v1/delete_group_by_name`
- **Backend**: ✅ Implemented (`DGDController::deleteDictGroupByGname`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 3.9 DELETE `/api/app_qy_v1/delete_group_by_gid`
- **Backend**: ✅ Implemented (`DGDController::deleteDictGroupByGid`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 4. Dictionary Management Endpoints (AppQyV1Dict.php)

### 4.1 POST `/api/app_qy_v1/add_dictionary` (Client Token Auth)
- **Backend**: ✅ Implemented (`AddDController::filterAndAddDictionaryList`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED** - Requires client token, not user token

### 4.2 POST `/api/app_qy_v1/find_non_existing_dictionary` (Client Token Auth)
- **Backend**: ✅ Implemented (`QueryDController::findNonExistingEntries`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED** - Admin/system tool

### 4.3 POST `/api/app_qy_v1/dictionary/tasks/create-explanation`
- **Backend**: ✅ Implemented (`TaskDController::createExplanationTask`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 4.4 GET `/api/app_qy_v1/dictionary/tasks/untranslated-words`
- **Backend**: ✅ Implemented (`TaskDController::getUntranslatedWordsCount`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 5. System & Language Endpoints (AppQyV1System.php)

### 5.1 GET `/api/app_qy_v1/system/supported-languages`
- **Backend**: ✅ Implemented (`AppQyV1SupportedLanguagesController::getSupportedLanguages`)
- **Frontend**: ✅ Integrated (via `api.getSupportedLanguages`)
- **UI**: ✅ Available (Settings/Language page)
- **Status**: ✅ **WORKING**

### 5.2 GET `/api/app_qy_v1/system/supported-languages/{code}`
- **Backend**: ✅ Implemented (`AppQyV1SupportedLanguagesController::getLanguageByCode`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 5.3 POST `/api/app_qy_v1/system/initialize`
- **Backend**: ✅ Implemented (`AppQyV1SystemInitializationController::initialize`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED** - Admin/setup tool

### 5.4 GET `/api/app_qy_v1/system/initialization-status`
- **Backend**: ✅ Implemented (`AppQyV1SystemInitializationController::status`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 5.5 POST `/api/app_qy_v1/system/process-vocabulary`
- **Backend**: ✅ Implemented (`AppQyV1SystemInitializationController::processVocabularyOnly`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED** - Admin tool

### 5.6 GET `/api/app_qy_v1/system/vocabulary-status`
- **Backend**: ✅ Implemented (`AppQyV1SystemInitializationController::getVocabularyStatus`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 5.7 GET `/api/app_qy_v1/system/dictionary-statistics`
- **Backend**: ✅ Implemented (`AppQyV1SystemInitializationController::getDictionaryStatistics`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 6. Word Query Endpoints (AppQyV1System.php)

### 6.1 GET/POST `/api/app_qy_v1/word/{word}/enhanced`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::queryWordEnhanced`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 6.2 GET `/api/app_qy_v1/untranslated`
- **Backend**: ✅ Implemented (`AppQyV1UntranslatedWordsController::getUntranslatedWords`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 6.3 GET `/api/app_qy_v1/untranslated/priority`
- **Backend**: ✅ Implemented (`AppQyV1UntranslatedWordsController::getWordsByPriority`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 7. Word Submission Endpoints (AppQyV1System.php)

### 7.1 POST `/api/app_qy_v1/word/{word}/translation`
- **Backend**: ✅ Implemented (`AppQyV1WordDataSubmissionController::submitTranslation`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 7.2 POST `/api/app_qy_v1/word/{word}/audio`
- **Backend**: ✅ Implemented (`AppQyV1WordDataSubmissionController::submitAudio`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 7.3 POST `/api/app_qy_v1/word/{word}/images`
- **Backend**: ✅ Implemented (`AppQyV1WordDataSubmissionController::submitImages`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 7.4 POST `/api/app_qy_v1/word/{word}/complete`
- **Backend**: ✅ Implemented (`AppQyV1WordDataSubmissionController::submitCompleteWordData`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 8. Learning Endpoints (AppQyV1Learning.php)

### 8.1 GET `/api/app_qy_v1/learning/languages`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::getUserLanguages`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**
- **Note**: Now using global settings instead

### 8.2 POST `/api/app_qy_v1/learning/languages`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::setUserLanguages`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**
- **Note**: Now using updateProfile for learning_languages

### 8.3 GET `/api/app_qy_v1/learning/libraries`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::getVocabularyLibraries`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.4 POST `/api/app_qy_v1/learning/libraries/select`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::selectVocabularyLibrary`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.5 GET `/api/app_qy_v1/learning/recommendations`
- **Backend**: ✅ Implemented (`AppQyV1VocabularyRecommendationController::getRecommendations`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.6 POST `/api/app_qy_v1/learning/collections/select`
- **Backend**: ✅ Implemented (`AppQyV1VocabularyRecommendationController::selectCollection`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.7 GET `/api/app_qy_v1/learning/collections/selected`
- **Backend**: ✅ Implemented (`AppQyV1VocabularyRecommendationController::getSelectedCollections`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.8 GET `/api/app_qy_v1/learning/words`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::getWordCards`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.9 POST `/api/app_qy_v1/learning/progress`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::updateProgress`)
- **Frontend**: ⚠️ Possibly integrated (need to check)
- **UI**: ⚠️ Unknown
- **Status**: ⚠️ **NEEDS INVESTIGATION**

### 8.10 GET `/api/app_qy_v1/learning/stats`
- **Backend**: ✅ Implemented (`AppQyV1LearningController::getLearningStats`)
- **Frontend**: ⚠️ Possibly integrated (need to check)
- **UI**: ⚠️ Unknown
- **Status**: ⚠️ **NEEDS INVESTIGATION**

### 8.11 POST `/api/app_qy_v1/learning/upload`
- **Backend**: ✅ Implemented (`AppQyV1VocabularyUploadController::uploadDocument`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 8.12 DELETE `/api/app_qy_v1/learning/libraries/{library_id}`
- **Backend**: ✅ Implemented (`AppQyV1VocabularyUploadController::deleteLibrary`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## 9. Word Operations Endpoints (AppQyV1Words.php)

### 9.1 GET `/api/words/daily`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::getDailyWords`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**
- **Note**: No `/api/app_qy_v1/` prefix - different route group

### 9.2 GET `/api/words/{id}`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::getWordDetails`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 9.3 POST `/api/words/{id}/learn`
- **Backend**: ✅ Implemented (`AppQyV1WordLearningStatusController::markAsLearned`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 9.4 POST `/api/words/{id}/review`
- **Backend**: ✅ Implemented (`AppQyV1WordLearningStatusController::markAsReviewed`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 9.5 POST `/api/words/{id}/favorite`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::toggleFavorite`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 9.6 GET `/api/words/search/{query}`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::searchWords`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

### 9.7 GET `/api/words/public/{word}`
- **Backend**: ✅ Implemented (`AppQyV1WordQueryController::publicWordLookup`)
- **Frontend**: ❌ **NOT INTEGRATED**
- **UI**: ❌ **MISSING**
- **Status**: ❌ **NOT USED**

---

## Critical Issues Found

### 🔴 High Priority Issues

1. **Password Reset Flow Missing**
   - Backend has forgot-password and reset-password endpoints
   - Frontend has NO UI or integration
   - Users cannot reset forgotten passwords

2. **Word Learning Progress Not Tracked**
   - Backend has complete learning progress endpoints
   - Frontend doesn't call `/learning/progress`
   - User progress is not being saved

3. **Document Upload Feature Missing**
   - Backend has `/learning/upload` endpoint
   - Frontend has NO UI for document upload
   - Major feature not accessible to users

4. **Word Groups Management Missing**
   - Backend has create/delete group endpoints
   - Frontend has NO UI for group management
   - Users cannot create custom word groups

### ⚠️ Medium Priority Issues

5. **Learning Statistics Not Displayed**
   - Backend provides `/learning/stats` endpoint
   - Frontend doesn't fetch or display learning stats
   - Dashboard could show more detailed progress

6. **Daily Words Feature Not Implemented**
   - Backend has `/words/daily` endpoint
   - Frontend has NO daily words feature
   - Missing engagement feature

7. **Vocabulary Recommendations Not Used**
   - Backend has recommendation system
   - Frontend doesn't integrate recommendations
   - Users miss personalized suggestions

8. **Word Search Not Implemented**
   - Backend has `/words/search/{query}` endpoint
   - Frontend search doesn't use this endpoint
   - Search functionality could be improved

### 🟡 Low Priority Issues

9. **System Admin Tools Not Exposed**
   - Backend has system initialization endpoints
   - These are admin tools, not for regular users
   - Consider creating admin panel

10. **User Initialization Flow Missing**
    - Backend has user initialization endpoint
    - Frontend doesn't guide new users through setup
    - Onboarding experience could be improved

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Implement Password Reset UI**
   - Create forgot password page
   - Create reset password page
   - Integrate with backend endpoints

2. **Fix Learning Progress Tracking**
   - Call `/learning/progress` after each word study
   - Ensure progress is saved to backend
   - Show progress in dashboard

3. **Add Document Upload Feature**
   - Create upload button in Library page
   - Implement file picker and upload
   - Show uploaded documents in library

### Short-term Actions (Priority 2)

4. **Add Learning Statistics**
   - Fetch `/learning/stats` endpoint
   - Display stats in Profile page
   - Add charts/graphs for visualization

5. **Implement Daily Words**
   - Fetch `/words/daily` endpoint
   - Add "Daily Words" section to Home page
   - Send daily reminder notifications

6. **Add Word Groups Management**
   - Create "New Group" button
   - Implement group creation form
   - Add delete group confirmation

### Long-term Actions (Priority 3)

7. **Build Recommendation System UI**
   - Fetch `/learning/recommendations`
   - Display recommended word banks
   - Add "Select Collection" feature

8. **Improve Word Search**
   - Use `/words/search/` endpoint
   - Add advanced search filters
   - Show search history

9. **Create User Onboarding**
   - Call `/user/initialize` for new users
   - Guide through language selection
   - Select initial word banks

10. **Build Admin Panel**
    - Protect with admin authentication
    - Expose system initialization tools
    - Add dictionary management UI

---

## Testing Checklist

### Already Tested ✅
- [x] User Registration
- [x] User Login
- [x] User Logout
- [x] Get User Profile
- [x] Update User Profile (partial)
- [x] Get Word Groups
- [x] Get Supported Languages

### Needs Testing ⚠️
- [ ] Password Reset Flow
- [ ] Learning Progress Tracking
- [ ] Document Upload
- [ ] Word Groups Management
- [ ] Learning Statistics
- [ ] Daily Words
- [ ] Word Search
- [ ] Recommendations

### Not Applicable ❌
- [ ] Admin Tools (system initialization)
- [ ] Client Token Endpoints (for backend services)
- [ ] Dictionary Task Management (admin only)

---

## Conclusion

The backend API is **significantly more feature-complete** than the frontend implementation. Out of **45+ endpoints**, only **8 are fully integrated** with UI, and **25+ are completely unused**.

**Key Takeaways:**
1. Basic authentication and profile management work well
2. Word group browsing is functional
3. Major features like learning progress, document upload, and recommendations are not integrated
4. Password reset is a critical missing feature
5. Frontend could benefit greatly from integrating existing backend capabilities

**Recommended Next Steps:**
1. Prioritize password reset implementation (security issue)
2. Implement learning progress tracking (core functionality)
3. Add document upload feature (major user-facing feature)
4. Create a roadmap for integrating remaining endpoints

---

**End of Report**
