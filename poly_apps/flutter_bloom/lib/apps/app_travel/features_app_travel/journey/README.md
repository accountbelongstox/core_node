# Journey Feature - My Itinerary & Orders

## Overview
This feature implements a tabbed interface for "My Itinerary" and "All Orders" with centralized data management.

## Architecture

### File Structure
```
features_app_travel/journey/
├── views/
│   └── journey_screen.dart          # Main screen with TabBar
├── widgets/
│   ├── my_itinerary_tab.dart        # "My Itinerary" tab content
│   └── all_orders_tab.dart          # "All Orders" tab content
```

### Data Layer
```
models_app_travel/
├── hot_content_model.dart            # Model for hot travel content
├── travel_inspiration_model.dart     # Model for travel inspiration items
└── order_model.dart                  # Model for orders (existing)

data/
├── journey_data.dart                 # Centralized data provider
└── orders_data.dart                  # Order data (existing)

services_app_travel/
└── journey_service.dart              # Business logic layer
```

## Features

### 1. Tab Navigation
- **My Itinerary Tab**: Displays travel inspiration and hot picks
- **All Orders Tab**: Displays order list with filters

### 2. Data Centralization
All data is managed through centralized services:
- `JourneyData`: Provides travel inspirations and hot contents
- `JourneyService`: Handles business logic and data fetching
- `TestOrdersData`: Manages order data

### 3. Component Separation
Each tab is a separate, reusable widget:
- `MyItineraryTab`: Self-contained tab with its own state management
- `AllOrdersTab`: Independent tab for order management

## Data Models

### HotContentModel
Represents hot travel content items (e.g., travel guides, tips):
```dart
- id: Unique identifier
- image: Image path
- title: Content title
- subtitle: Content description
- author: Content author
- likes: Number of likes
- category: Content category (optional)
- publishDate: Publication date (optional)
```

### TravelInspirationModel
Represents travel inspiration items (e.g., maps, guides):
```dart
- id: Unique identifier
- title: Inspiration title
- subtitle: Brief description
- imageUrl: Image URL
- description: Detailed description (optional)
- category: Category (optional)
- itemCount: Number of items (optional)
```

## How to Use

### Adding New Hot Contents
Edit `lib/apps/app_travel/data/journey_data.dart`:

```dart
HotContentModel(
  id: 'hot_005',
  image: 'assets/apps/app_travel/images/your_image.png',
  title: 'Your Title',
  subtitle: 'Your Subtitle',
  author: 'Author Name',
  likes: 100,
  category: 'Category',
),
```

### Adding Travel Inspirations
Edit `lib/apps/app_travel/data/journey_data.dart`:

```dart
TravelInspirationModel(
  id: 'inspiration_002',
  title: 'New Inspiration',
  subtitle: 'Description',
  imageUrl: 'assets/path/to/image.png',
  itemCount: 25,
),
```

### Fetching Data
Use `JourneyService` for data operations:

```dart
final journeyService = JourneyService();

// Get all hot contents
final hotContents = await journeyService.fetchHotContents();

// Get travel inspirations
final inspirations = await journeyService.fetchTravelInspirations();

// Search hot contents
final results = await journeyService.searchHotContents('keyword');
```

## Key Design Principles

### 1. Data Centralization
- ✅ No hardcoded data in UI components
- ✅ All data managed through centralized data files
- ✅ Service layer for business logic

### 2. Component Reusability
- ✅ Separate widgets for each tab
- ✅ AutomaticKeepAliveClientMixin for state preservation
- ✅ RefreshIndicator for pull-to-refresh

### 3. Maintainability
- ✅ Clear separation of concerns
- ✅ Documented code with comments
- ✅ Type-safe data models

## Future Enhancements

1. **API Integration**: Replace mock data with real API calls
2. **Pagination**: Add pagination for large datasets
3. **Caching**: Implement local caching for offline support
4. **Filtering**: Add more filtering options for hot contents
5. **Favorites**: Allow users to favorite hot contents
6. **Sharing**: Add sharing functionality for travel guides

## Testing

To test the implementation:

1. Navigate to the Journey screen
2. Switch between "My Itinerary" and "All Orders" tabs
3. Pull to refresh on "My Itinerary" tab
4. Filter orders on "All Orders" tab
5. Search for orders using the search bar

## Related Files

- Journey Screen: `lib/apps/app_travel/features_app_travel/journey/views/journey_screen.dart`
- Data Models: `lib/apps/app_travel/models_app_travel/`
- Data Files: `lib/apps/app_travel/data/`
- Services: `lib/apps/app_travel/services_app_travel/`

## Notes

- Images should be placed in `assets/apps/app_travel/images/`
- All hot content images (hot_content_1.png to hot_content_4.png) should exist
- Empty order mascot image: `empty_order_mascot.png`
- Journey inspiration map image: `journey_inspiration_map.png`
