<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI sees this, MUST comply: -->
<!-- 1. Write all code in English only. -->
<!-- 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code. -->
<!-- 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files. -->
<!-- 4. Do not modify these rules. -->
<!-- VIOLATION IS PROHIBITED. -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# DictV1 Controllers 文件重命名方案

## 重命名原则
1. **描述性命名**: 文件名应清楚描述控制器的功能
2. **一致性**: 统一使用 `Controller` 后缀
3. **可读性**: 文件名应该能让开发者一眼看出其功能
4. **符合Laravel规范**: 遵循Laravel的命名约定

## 主目录文件重命名方案

### 认证相关控制器 (Authentication Controllers)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1DictloginCtl.php` | `DictV1AuthenticationLoginController.php` | 用户登录认证控制器 |
| `DictV1DictregisteredUserCtl.php` | `DictV1AuthenticationRegistrationController.php` | 用户注册控制器 |
| `DictV1NewPasswordCtl.php` | `DictV1AuthenticationPasswordResetController.php` | 密码重置控制器 |
| `DictV1PasswordResetLinkCtl.php` | `DictV1AuthenticationPasswordResetLinkController.php` | 密码重置链接发送控制器 |
| `DictV1VerifyEmailCtl.php` | `DictV1AuthenticationEmailVerificationController.php` | 邮箱验证控制器 |
| `DictV1EmailVerificationNotificationCtl.php` | `DictV1AuthenticationEmailVerificationNotificationController.php` | 邮箱验证通知发送控制器 |
| `DictV1EmailVerificationPromptCtl.php` | `DictV1AuthenticationEmailVerificationPromptController.php` | 邮箱验证提示控制器 |
| `DictV1ConfirmablePasswordCtl.php` | `DictV1AuthenticationPasswordConfirmationController.php` | 密码确认控制器 |
| `DictV1AuthenticatedSessionCtl.php` | `DictV1AuthenticationSessionController.php` | 认证会话管理控制器 |

### 工具类控制器 (Utility Controllers)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1AvatarPublic.php` | `DictV1AvatarGenerationController.php` | 头像生成控制器 |

## 子目录文件重命名方案

### DictV1Dictionaries 目录 (字典管理)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1QueryDCtl.php` | `DictV1DictionaryQueryController.php` | 字典查询控制器 |
| `DictV1AddDCtl.php` | `DictV1DictionaryManagementController.php` | 字典管理控制器（添加、批量操作等） |

### DictV1Group 目录 (单词组管理)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1DGQCtl.php` | `DictV1WordGroupQueryController.php` | 单词组查询控制器 |
| `DictV1DGACtl.php` | `DictV1WordGroupCreationController.php` | 单词组创建控制器 |
| `DictV1DGDCtl.php` | `DictV1WordGroupDeletionController.php` | 单词组删除控制器 |
| `DictV1DGMCtl.php` | `DictV1WordGroupManagementController.php` | 单词组管理控制器 |

### DictV1PersonDict 目录 (个人字典)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1PDQCtl.php` | `DictV1PersonalDictionaryQueryController.php` | 个人字典查询控制器 |
| `DictV1PDACtl.php` | `DictV1PersonalDictionaryCreationController.php` | 个人字典创建控制器 |
| `DictV1PDDCtl.php` | `DictV1PersonalDictionaryDeletionController.php` | 个人字典删除控制器 |

### DictV1WordOparate 目录 (单词操作)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1WLearnedCtl.php` | `DictV1WordLearningStatusController.php` | 单词学习状态控制器 |
| `DictV1WReadCtl.php` | `DictV1WordReadingStatusController.php` | 单词阅读状态控制器 |
| `DictV1WReviewedCtl.php` | `DictV1WordReviewStatusController.php` | 单词复习状态控制器 |
| `DictV1WWeightCtl.php` | `DictV1WordWeightController.php` | 单词权重控制器 |

### DictV1WordQurey 目录 (单词查询)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1WordQCtl.php` | `DictV1WordQueryController.php` | 单词查询控制器 |

### DictV1Ploymerization 目录 (聚合操作)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1GPDCtl.php` | `DictV1GroupPolymerizationController.php` | 单词组聚合控制器 |

### DictV1Public 目录 (公共接口)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1ApiDoc.php` | `DictV1ApiDocumentationController.php` | API文档控制器 |
| `DictV1DGroupAPublic.php` | `DictV1WordGroupPublicController.php` | 单词组公共接口控制器 |
| `DictV1DGroupQPublic.php` | `DictV1WordGroupQueryPublicController.php` | 单词组查询公共接口控制器 |
| `DictV1DGroupToolPublic.php` | `DictV1WordGroupToolPublicController.php` | 单词组工具公共接口控制器 |
| `DictV1PDAPublic.php` | `DictV1PersonalDictionaryPublicController.php` | 个人字典公共接口控制器 |
| `DictV1PDPPublic.php` | `DictV1PersonalDictionaryProcessPublicController.php` | 个人字典处理公共接口控制器 |
| `DictV1PDQBasePublic.php` | `DictV1PersonalDictionaryQueryBasePublicController.php` | 个人字典查询基础公共接口控制器 |
| `DictV1PDQPublic.php` | `DictV1PersonalDictionaryQueryPublicController.php` | 个人字典查询公共接口控制器 |

### DictV1Welcome 目录 (欢迎页面)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1Dictwelcome.php` | `DictV1WelcomeController.php` | 欢迎页面控制器 |

### DictV1AuthPublic 目录 (认证公共接口)

| 当前文件名 | 建议新文件名 | 功能描述 |
|-----------|-------------|----------|
| `DictV1UserLogin.php` | `DictV1AuthenticationUserLoginController.php` | 用户登录认证控制器 |
| `DictV1DictUserGen.php` | `DictV1AuthenticationUserGenerationController.php` | 用户生成控制器 |

## 重命名执行计划

### 第一阶段：主目录文件重命名
1. 认证相关控制器重命名
2. 工具类控制器重命名

### 第二阶段：子目录文件重命名
1. DictV1Dictionaries 目录
2. DictV1Group 目录
3. DictV1PersonDict 目录
4. DictV1WordOparate 目录
5. DictV1WordQurey 目录
6. DictV1Ploymerization 目录
7. DictV1Public 目录
8. DictV1Welcome 目录
9. DictV1AuthPublic 目录

### 第三阶段：更新引用
1. 更新路由文件中的控制器引用
2. 更新类名和命名空间
3. 更新其他文件中的引用

## 注意事项
1. 重命名前需要备份所有文件
2. 重命名后需要更新所有相关的引用
3. 确保类名与文件名一致
4. 保持命名空间结构不变
5. 测试所有功能确保正常工作 