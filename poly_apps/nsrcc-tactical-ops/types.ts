export interface NavItem {
  label: string;
  path: string;
  icon: any; // Lucide icon component
}

export enum PageRoutes {
  HOME = '/',
  LOGIN = '/login',
  GOLF = '/golf',
  SOCIAL = '/social',
  BUNGALOW = '/bungalow',
  DINING = '/dining',
  SETTINGS = '/settings',
  SHOOTING = '/shooting',
  VIP = '/vip',
  CUSTOMER_SERVICE = '/service'
}

export interface UserProfile {
  name: string;
  id: string;
  vipLevel: number;
}