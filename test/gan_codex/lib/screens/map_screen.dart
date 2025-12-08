import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../widgets/app_drawer.dart';

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final firstFriend = appState.friends.first;
    final latLng = LatLng(
      firstFriend.location.latitude,
      firstFriend.location.longitude,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(appState.t('map.active')),
        actions: [
          IconButton(
            icon: const Icon(Icons.people_outline),
            onPressed: () => Navigator.pushNamed(context, '/friends'),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              options: MapOptions(
                initialCenter: latLng,
                initialZoom: 13,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.holofortune.flutter',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: latLng,
                      width: 60,
                      height: 60,
                      child: Column(
                        children: [
                          const Icon(Icons.location_on,
                              color: Colors.red, size: 32),
                          Text(firstFriend.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundImage: NetworkImage(firstFriend.avatar),
                ),
                title: Text(firstFriend.name),
                subtitle: Text(firstFriend.location.address),
                trailing: Text(firstFriend.lastActive),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
