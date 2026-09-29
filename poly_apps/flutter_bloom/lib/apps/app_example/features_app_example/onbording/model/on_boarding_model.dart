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
