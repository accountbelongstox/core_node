
import React from 'react';
import { MembershipTier, Plan, SystemStatus, UptimePoint } from './types';

const generateHistory = (length: number): UptimePoint[] => 
  Array.from({ length }, () => ({
    status: Math.random() > 0.08 ? 'up' : (Math.random() > 0.5 ? 'partial' : 'down')
  }));

export const AVAILABILITY_DATA: SystemStatus[] = [
  { 
    name: 'Gemini 3 Pro', 
    status: 'operational', 
    latency: '820ms', 
    uptime: 99.99,
    history: generateHistory(30)
  },
  { 
    name: 'Claude 3.5 Sonnet', 
    status: 'operational', 
    latency: '1.4s', 
    uptime: 99.97,
    history: generateHistory(30)
  },
  { 
    name: 'GPT-4o Codex', 
    status: 'operational', 
    latency: '950ms', 
    uptime: 99.98,
    history: generateHistory(30)
  },
  { 
    name: 'DeepSeek V3', 
    status: 'operational', 
    latency: '1.8s', 
    uptime: 99.94,
    history: generateHistory(30)
  },
  { 
    name: 'Llama 3.1 Neural', 
    status: 'operational', 
    latency: '1.1s', 
    uptime: 99.96,
    history: generateHistory(30)
  },
  { 
    name: 'Neural Forwarder V3', 
    status: 'operational', 
    latency: '12ms', 
    uptime: 100,
    history: generateHistory(30)
  },
  { 
    name: 'Image Gen (Flux/DALL-E)', 
    status: 'degraded', 
    latency: '5.2s', 
    uptime: 98.15,
    history: generateHistory(30)
  },
];

export const HISTORICAL_UPTIME = generateHistory(45);

export const PLANS: Plan[] = [
  {
    id: MembershipTier.FREE,
    name: "Nexus Core",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring the possibilities of AI.",
    features: [
      { name: "50,000 monthly tokens", included: true },
      { name: "Standard generation speed", included: true },
      { name: "Basic models (Gemini Flash)", included: true },
      { name: "Custom API access", included: false },
      { name: "Priority support", included: false }
    ]
  },
  {
    id: MembershipTier.PRO,
    name: "Nexus Pro",
    price: "$29",
    period: "per month",
    description: "For professionals who need more power and speed.",
    isPopular: true,
    features: [
      { name: "5,000,000 monthly tokens", included: true },
      { name: "Turbo generation speed", included: true },
      { name: "Advanced models (Claude/Gemini Pro)", included: true },
      { name: "Unlimited API endpoints", included: true },
      { name: "Priority support", included: true }
    ]
  },
  {
    id: MembershipTier.ULTIMATE,
    name: "Nexus Enterprise",
    price: "$99",
    period: "per month",
    description: "The ultimate power for businesses and heavy users.",
    features: [
      { name: "Unlimited tokens", included: true },
      { name: "Dedicated compute nodes", included: true },
      { name: "Ultra-low latency", included: true },
      { name: "Full governance & SSO", included: true },
      { name: "24/7 Concierge support", included: true }
    ]
  }
];

export const Icons = {
  Cpu: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>
  ),
  Zap: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  Shield: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  Activity: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )
};
