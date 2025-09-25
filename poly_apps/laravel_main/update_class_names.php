<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


// 批量更新类名的脚本
$controllersDir = __DIR__ . '/app/Apps/DictV1/Controllers';

function updateClassNameInFile($filePath, $oldClassName, $newClassName) {
    $content = file_get_contents($filePath);
    $updatedContent = str_replace($oldClassName, $newClassName, $content);
    file_put_contents($filePath, $updatedContent);
    echo "Updated class name in: $filePath\n";
}

// 主目录文件类名更新
$mainDirFiles = [
    'DictV1AuthenticationLoginController.php' => ['DictloginController', 'DictV1AuthenticationLoginController'],
    'DictV1AuthenticationRegistrationController.php' => ['DictregisteredUserController', 'DictV1AuthenticationRegistrationController'],
    'DictV1AuthenticationPasswordResetController.php' => ['NewPasswordController', 'DictV1AuthenticationPasswordResetController'],
    'DictV1AuthenticationPasswordResetLinkController.php' => ['PasswordResetLinkController', 'DictV1AuthenticationPasswordResetLinkController'],
    'DictV1AuthenticationEmailVerificationController.php' => ['VerifyEmailController', 'DictV1AuthenticationEmailVerificationController'],
    'DictV1AuthenticationEmailVerificationNotificationController.php' => ['EmailVerificationNotificationController', 'DictV1AuthenticationEmailVerificationNotificationController'],
    'DictV1AuthenticationEmailVerificationPromptController.php' => ['EmailVerificationPromptController', 'DictV1AuthenticationEmailVerificationPromptController'],
    'DictV1AuthenticationPasswordConfirmationController.php' => ['ConfirmablePasswordController', 'DictV1AuthenticationPasswordConfirmationController'],
    'DictV1AuthenticationSessionController.php' => ['AuthenticatedSessionController', 'DictV1AuthenticationSessionController'],
    'DictV1AvatarGenerationController.php' => ['AvatarPublic', 'DictV1AvatarGenerationController'],
];

foreach ($mainDirFiles as $filename => $classNames) {
    $filePath = $controllersDir . '/' . $filename;
    if (file_exists($filePath)) {
        updateClassNameInFile($filePath, $classNames[0], $classNames[1]);
    }
}

// 子目录文件类名更新
$subDirFiles = [
    'DictV1Dictionaries/DictV1DictionaryQueryController.php' => ['QueryDController', 'DictV1DictionaryQueryController'],
    'DictV1Dictionaries/DictV1DictionaryManagementController.php' => ['AddDController', 'DictV1DictionaryManagementController'],
    'DictV1Group/DictV1WordGroupQueryController.php' => ['DGQController', 'DictV1WordGroupQueryController'],
    'DictV1Group/DictV1WordGroupCreationController.php' => ['DGAController', 'DictV1WordGroupCreationController'],
    'DictV1Group/DictV1WordGroupDeletionController.php' => ['DGDController', 'DictV1WordGroupDeletionController'],
    'DictV1Group/DictV1WordGroupManagementController.php' => ['DGMController', 'DictV1WordGroupManagementController'],
    'DictV1PersonDict/DictV1PersonalDictionaryQueryController.php' => ['PDQController', 'DictV1PersonalDictionaryQueryController'],
    'DictV1PersonDict/DictV1PersonalDictionaryCreationController.php' => ['PDAController', 'DictV1PersonalDictionaryCreationController'],
    'DictV1PersonDict/DictV1PersonalDictionaryDeletionController.php' => ['PDDController', 'DictV1PersonalDictionaryDeletionController'],
    'DictV1WordOparate/DictV1WordLearningStatusController.php' => ['WLearnedController', 'DictV1WordLearningStatusController'],
    'DictV1WordOparate/DictV1WordReadingStatusController.php' => ['WReadController', 'DictV1WordReadingStatusController'],
    'DictV1WordOparate/DictV1WordReviewStatusController.php' => ['WReviewedController', 'DictV1WordReviewStatusController'],
    'DictV1WordOparate/DictV1WordWeightController.php' => ['WWeightController', 'DictV1WordWeightController'],
    'DictV1WordQurey/DictV1WordQueryController.php' => ['WordQController', 'DictV1WordQueryController'],
    'DictV1Ploymerization/DictV1GroupPolymerizationController.php' => ['GPDController', 'DictV1GroupPolymerizationController'],
    'DictV1Public/DictV1ApiDocumentationController.php' => ['ApiDoc', 'DictV1ApiDocumentationController'],
    'DictV1Public/DictV1WordGroupPublicController.php' => ['DGroupAPublic', 'DictV1WordGroupPublicController'],
    'DictV1Public/DictV1WordGroupQueryPublicController.php' => ['DGroupQPublic', 'DictV1WordGroupQueryPublicController'],
    'DictV1Public/DictV1WordGroupToolPublicController.php' => ['DGroupToolPublic', 'DictV1WordGroupToolPublicController'],
    'DictV1Public/DictV1PersonalDictionaryPublicController.php' => ['PDAPublic', 'DictV1PersonalDictionaryPublicController'],
    'DictV1Public/DictV1PersonalDictionaryProcessPublicController.php' => ['PDPPublic', 'DictV1PersonalDictionaryProcessPublicController'],
    'DictV1Public/DictV1PersonalDictionaryQueryBasePublicController.php' => ['PDQBasePublic', 'DictV1PersonalDictionaryQueryBasePublicController'],
    'DictV1Public/DictV1PersonalDictionaryQueryPublicController.php' => ['PDQPublic', 'DictV1PersonalDictionaryQueryPublicController'],
    'DictV1Welcome/DictV1WelcomeController.php' => ['Dictwelcome', 'DictV1WelcomeController'],
    'DictV1AuthPublic/DictV1AuthenticationUserLoginController.php' => ['UserLogin', 'DictV1AuthenticationUserLoginController'],
    'DictV1AuthPublic/DictV1AuthenticationUserGenerationController.php' => ['DictUserGen', 'DictV1AuthenticationUserGenerationController'],
];

foreach ($subDirFiles as $filePath => $classNames) {
    $fullPath = $controllersDir . '/' . $filePath;
    if (file_exists($fullPath)) {
        updateClassNameInFile($fullPath, $classNames[0], $classNames[1]);
    }
}

echo "Class name update completed!\n"; 