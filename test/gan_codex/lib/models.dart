import 'package:flutter/material.dart';

class FriendLocation {
  const FriendLocation({
    required this.latitude,
    required this.longitude,
    required this.address,
  });

  final double latitude;
  final double longitude;
  final String address;
}

class FriendHealth {
  const FriendHealth({
    required this.steps,
    required this.heartRate,
    required this.temperature,
  });

  final int steps;
  final int heartRate;
  final double temperature;
}

class FriendDevice {
  const FriendDevice({
    required this.network,
    required this.unlocks,
    required this.usageTime,
  });

  final String network;
  final int unlocks;
  final String usageTime;
}

class Friend {
  const Friend({
    required this.id,
    required this.name,
    required this.phone,
    required this.avatar,
    required this.relation,
    required this.daysConnected,
    required this.lastActive,
    required this.isMonitored,
    required this.location,
    required this.health,
    required this.device,
  });

  final String id;
  final String name;
  final String phone;
  final String avatar;
  final String relation;
  final int daysConnected;
  final String lastActive;
  final bool isMonitored;
  final FriendLocation location;
  final FriendHealth health;
  final FriendDevice device;

  Friend copyWith({
    bool? isMonitored,
  }) {
    return Friend(
      id: id,
      name: name,
      phone: phone,
      avatar: avatar,
      relation: relation,
      daysConnected: daysConnected,
      lastActive: lastActive,
      isMonitored: isMonitored ?? this.isMonitored,
      location: location,
      health: health,
      device: device,
    );
  }
}

class User {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    required this.avatar,
    required this.signature,
    required this.gender,
    required this.address,
    required this.email,
    required this.idCard,
  });

  final String id;
  final String name;
  final String phone;
  final String avatar;
  final String signature;
  final String gender;
  final String address;
  final String email;
  final String idCard;

  User copyWith({
    String? name,
    String? phone,
    String? signature,
    String? address,
  }) {
    return User(
      id: id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      avatar: avatar,
      signature: signature ?? this.signature,
      gender: gender,
      address: address ?? this.address,
      email: email,
      idCard: idCard,
    );
  }
}

@immutable
class TimelineEntry {
  const TimelineEntry({
    required this.title,
    required this.description,
    required this.timestamp,
  });

  final String title;
  final String description;
  final DateTime timestamp;
}
