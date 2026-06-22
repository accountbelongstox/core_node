/**
 * Image URL Utils - Usage Examples
 * 
 * Demonstrates how to use the new image URL service, references old .js code logic
 * Uses multi-API system to generate absolute URLs (abs-api-url)
 */

import React from 'react';
import { apiService } from '../services/apiService';
import { generateImageUrl, getImageUrlForCustomer, getImageUrl, ImageType } from './imageUrlUtils';

/**
 * Example 1: Generate image URL using user identifiers like customer1
 * References old .js code processing logic
 */
export function CustomerImageExample() {
  const customerId = 'customer1';
  
  // Method 1: Use apiService (recommended)
  const imageUrl1 = apiService.getCustomerImageUrl(customerId, 150, 'pravatar');
  
  // Method 2: Use utility function directly
  const imageUrl2 = getImageUrlForCustomer(customerId, 150, 'pravatar');
  
  // Method 3: Use generic method
  const imageUrl3 = generateImageUrl(customerId, 'avatar', { size: 150, provider: 'pravatar' });
  
  return (
    <div>
      <img src={imageUrl1} alt="Customer 1" />
      <img src={imageUrl2} alt="Customer 1" />
      <img src={imageUrl3} alt="Customer 1" />
    </div>
  );
}

/**
 * Example 2: Generate image URL using relative paths
 */
export function RelativePathImageExample() {
  // Avatar type - relative path
  const avatarUrl1 = generateImageUrl('avatars/appqyv1/avatar_1.png', 'avatar');
  
  // Upload type
  const uploadUrl = generateImageUrl('uploads/user123/document.pdf', 'upload');
  
  // Static type
  const staticUrl = generateImageUrl('static/logo.png', 'static');
  
  return (
    <div>
      <img src={avatarUrl1} alt="Avatar" />
      <img src={uploadUrl} alt="Upload" />
      <img src={staticUrl} alt="Static" />
    </div>
  );
}

/**
 * Example 3: Encrypted image processing
 * References old .js code encrypted image processing logic
 */
export function EncryptedImageExample() {
  // Encrypted images use relative path directly (in public directory)
  const encryptedIconUrl = generateImageUrl('/encrypted_assets/app_icon1.en.js', 'encrypted');
  
  return (
    <div>
      <img src={encryptedIconUrl} alt="Encrypted Icon" />
    </div>
  );
}

/**
 * Example 4: Usage in components (real-world scenario)
 */
export function ChatSessionExample({ customerId, customerAvatar }: { customerId: string; customerAvatar?: string }) {
  // Prefer customerAvatar if provided, otherwise generate from customerId
  const avatarUrl = customerAvatar 
    ? generateImageUrl(customerAvatar, 'avatar')
    : getImageUrlForCustomer(customerId, 150, 'pravatar');
  
  return (
    <div className="flex items-center gap-3">
      <img 
        src={avatarUrl} 
        alt={`Customer ${customerId}`}
        className="w-10 h-10 rounded-full"
      />
      <span>Customer {customerId}</span>
    </div>
  );
}

/**
 * Example 5: Batch generate image URLs
 */
export function BatchImageExample() {
  const customers = ['customer1', 'customer2', 'customer3'];
  
  const customerUrls = customers.map(customerId => ({
    id: customerId,
    url: getImageUrlForCustomer(customerId, 150, 'pravatar')
  }));
  
  return (
    <div>
      {customerUrls.map(({ id, url }) => (
        <img key={id} src={url} alt={id} className="w-10 h-10 rounded-full" />
      ))}
    </div>
  );
}

/**
 * Example 6: Use apiService (recommended approach)
 * This is the most recommended approach as apiService already integrates multi-API system
 */
export function ApiServiceExample() {
  // Use apiService methods
  const customerUrl = apiService.getCustomerImageUrl('customer1', 150, 'pravatar');
  const imageUrl = apiService.getImageUrl('avatars/appqyv1/avatar_1.png', 'avatar');
  
  return (
    <div>
      <img src={customerUrl} alt="Customer 1" />
      <img src={imageUrl} alt="Avatar" />
    </div>
  );
}

/**
 * Migration Guide: Migrating from old .js code to React
 * 
 * Old .js code:
 * ```javascript
 * // Old .js code might handle images like this
 * const imageUrl = '/api/files/avatars/customer1.png';
 * // or
 * const imageUrl = getApiBaseUrl() + '/api/public/avatar/customer1?size=150';
 * ```
 * 
 * New React code:
 * ```typescript
 * // Use new image URL service
 * import { getImageUrlForCustomer } from '../utils/imageUrlUtils';
 * const imageUrl = getImageUrlForCustomer('customer1', 150, 'pravatar');
 * 
 * // or use apiService
 * import { apiService } from '../services/apiService';
 * const imageUrl = apiService.getCustomerImageUrl('customer1', 150, 'pravatar');
 * ```
 * 
 * Advantages:
 * 1. Automatically uses multi-API system to detect available API endpoints
 * 2. Automatically generates absolute URLs (abs-api-url)
 * 3. TypeScript type safety
 * 4. Unified API interface
 */

