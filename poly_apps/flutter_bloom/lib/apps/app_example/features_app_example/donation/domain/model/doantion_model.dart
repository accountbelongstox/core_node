import 'package:qyflutter/common/assets/common_assets_images.dart';

class DonationModel {
  final String? title;
  final String? image;
  final String? donators;
  final String? found;
  final String? days;

  DonationModel({this.title, this.days, this.donators, this.image, this.found});
}

List<DonationModel> donationModelList = [
  DonationModel(
    days: "1",
    found: "8,586",
    donators: "396",
    image: CommonAssetsImages.child6,
    title: "Donate to Help Children and Refugees",
  ),
  DonationModel(
    days: "3",
    found: "3,638",
    donators: "258",
    image: CommonAssetsImages.child2,
    title: "Stand ready to respond swiftly and effectively",
  ),
  DonationModel(
    days: "2",
    found: "1,425",
    donators: "460",
    image: CommonAssetsImages.helpChild,
    title: "We offer a wide range of programs",
  ),
  DonationModel(
    days: "5",
    found: "7,425",
    donators: "182",
    image: CommonAssetsImages.child3,
    title: "leading the massive humanitarian effort",
  ),
];
