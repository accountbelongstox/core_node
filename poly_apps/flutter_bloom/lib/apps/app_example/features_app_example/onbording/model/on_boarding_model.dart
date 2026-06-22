// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

class OnBoardingModel {
  final String onBoardingTitle;
  final String onBoardingBody;
  final String onBoardingImage;

  OnBoardingModel(
      {required this.onBoardingTitle,
      required this.onBoardingBody,
      required this.onBoardingImage});
}

List<OnBoardingModel> onBoardingData = [
  OnBoardingModel(
      onBoardingTitle:
          "Donate easily,quickly, right on target all over the world ",
      // Note: Using placeholder path until onboarding images are added to common assets
      onBoardingImage: "assets/common_images/onbording1.png",
      onBoardingBody:
          "Install loyverse Dashboard, loyverse kitchen Display and loyverse Customer Display multiple payment methods and more"),
  OnBoardingModel(
    onBoardingTitle: "Create your own fundraising and publish it to world ",
    onBoardingBody:
        "Sell from a smart phone or tablet,computer. issue printed or electronic receipts, accept multiple payment methods and more.",
    // Note: Using placeholder path until onboarding images are added to common assets
    onBoardingImage: "assets/common_images/onbording2.png",
  ),
  OnBoardingModel(
    onBoardingTitle: "Trusted, transparent kindness",
    onBoardingBody:
        "Track your sales and inventory, manage employees and customers in a browser on any device",
    // Note: Using placeholder path until onboarding images are added to common assets
    onBoardingImage: "assets/common_images/onbording3.png",
  )
];
