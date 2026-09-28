import 'package:qyflutter/common/assets/common_assets_images.dart';

class MyFundraisingModel {
  final String? title;
  final String? image;
  final String? donators;
  final String? days;

  MyFundraisingModel({
    this.title,
    this.days,
    this.donators,
    this.image,
  });
}

List<MyFundraisingModel> myFundraisingModelList = [
  //MyFundraisingModel(days: "1", donators:"25.2251",image: CommonAssetsIcons.hospital,title: "supported emergency department of Radar Hospital", ),
  MyFundraisingModel(
    days: "3",
    donators: "45.362",
    image: CommonAssetsImages.baby3,
    title: "after fighters from it and other groups carried",
  ),
  MyFundraisingModel(
    days: "2",
    donators: "78.269",
    image: CommonAssetsImages.fire,
    title: "When a fire burns a house, not just a structure is destroyed.",
  ),
  MyFundraisingModel(
    days: "4",
    donators: "252.335",
    image: CommonAssetsImages.flood,
    title: "Flash flood alerts issued for northeastern districts",
  ),
];
