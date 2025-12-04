// Centralized Model Store
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Device, DeviceGroup, DeviceLog } from '../types';
import { apiClient } from '../services/api/client';
import { wsClient, WebSocketStatus } from '../services/websocket/client';

interface AppState {
  // Devices
  devices: Device[];
  selectedDeviceIds: Set<string>;
  activeDevice: Device | null;

  // Groups
  groups: DeviceGroup[];
  selectedGroupId: string | null;

  // UI State
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  isFullView: boolean;

  // Connection State
  wsStatus: WebSocketStatus;
  apiConnected: boolean;

  // Logs
  logs: DeviceLog[];

  // Filters
  filterStatus: string;
  searchQuery: string;
}

type AppAction =
  | { type: 'SET_DEVICES'; payload: Device[] }
  | { type: 'UPDATE_DEVICE'; payload: Device }
  | { type: 'SELECT_DEVICE'; payload: { serial: string; multi: boolean } }
  | { type: 'SET_ACTIVE_DEVICE'; payload: Device | null }
  | { type: 'SET_GROUPS'; payload: DeviceGroup[] }
  | { type: 'SELECT_GROUP'; payload: string | null }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'SET_RIGHT_PANEL_COLLAPSED'; payload: boolean }
  | { type: 'SET_FULL_VIEW'; payload: boolean }
  | { type: 'SET_WS_STATUS'; payload: WebSocketStatus }
  | { type: 'SET_API_CONNECTED'; payload: boolean }
  | { type: 'ADD_LOG'; payload: DeviceLog }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string };

const initialState: AppState = {
  devices: [],
  selectedDeviceIds: new Set(),
  activeDevice: null,
  groups: [],
  selectedGroupId: null,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  isFullView: false,
  wsStatus: 'disconnected',
  apiConnected: false,
  logs: [],
  filterStatus: 'all',
  searchQuery: '',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DEVICES':
      return { ...state, devices: action.payload };

    case 'UPDATE_DEVICE':
      return {
        ...state,
        devices: state.devices.map((d) =>
          d.serial === action.payload.serial ? action.payload : d
        ),
        activeDevice:
          state.activeDevice?.serial === action.payload.serial
            ? action.payload
            : state.activeDevice,
      };

    case 'SELECT_DEVICE': {
      const newSet = new Set(
        action.payload.multi ? state.selectedDeviceIds : []
      );
      if (newSet.has(action.payload.serial)) {
        newSet.delete(action.payload.serial);
      } else {
        newSet.add(action.payload.serial);
      }
      return { ...state, selectedDeviceIds: newSet };
    }

    case 'SET_ACTIVE_DEVICE':
      return { ...state, activeDevice: action.payload };

    case 'SET_GROUPS':
      return { ...state, groups: action.payload };

    case 'SELECT_GROUP':
      return { ...state, selectedGroupId: action.payload };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.payload };

    case 'SET_RIGHT_PANEL_COLLAPSED':
      return { ...state, rightPanelCollapsed: action.payload };

    case 'SET_FULL_VIEW':
      return { ...state, isFullView: action.payload };

    case 'SET_WS_STATUS':
      return { ...state, wsStatus: action.payload };

    case 'SET_API_CONNECTED':
      return { ...state, apiConnected: action.payload };

    case 'ADD_LOG':
      return {
        ...state,
        logs: [...state.logs, action.payload].slice(-100),
      };

    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Actions
  loadDevices: () => Promise<void>;
  loadGroups: () => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load devices from API
  const loadDevices = async () => {
    try {
      const response = await apiClient.getDevices();
      if (response.success && response.data) {
        const devices = Array.isArray(response.data)
          ? response.data
          : response.data.devices || [];
        dispatch({ type: 'SET_DEVICES', payload: devices });
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  // Load groups from API
  const loadGroups = async () => {
    try {
      const response = await apiClient.getGroups();
      if (response.success && response.data) {
        const groups = Array.isArray(response.data)
          ? response.data
          : response.data.groups || [];
        dispatch({ type: 'SET_GROUPS', payload: groups });
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  // Connect WebSocket
  const connectWebSocket = async () => {
    try {
      await wsClient.connect();
      dispatch({ type: 'SET_WS_STATUS', payload: 'connected' });

      // Set up device list updates
      wsClient.on('device', 'list', (response) => {
        if (response.data?.devices) {
          dispatch({ type: 'SET_DEVICES', payload: response.data.devices });
        }
      });

      // Set up device updates
      wsClient.on('device', '*', (response) => {
        if (response.data?.device) {
          dispatch({ type: 'UPDATE_DEVICE', payload: response.data.device });
        }
      });
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      dispatch({ type: 'SET_WS_STATUS', payload: 'error' });
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    wsClient.disconnect();
    dispatch({ type: 'SET_WS_STATUS', payload: 'disconnected' });
  };

  // Initialize connections
  useEffect(() => {
    // Check API health
    apiClient
      .getHealth()
      .then((response) => {
        dispatch({ type: 'SET_API_CONNECTED', payload: response.success });
      })
      .catch(() => {
        dispatch({ type: 'SET_API_CONNECTED', payload: false });
      });

    // Connect WebSocket
    connectWebSocket();

    // Load initial data
    loadDevices();
    loadGroups();

    // Set up WebSocket status listener
    const unsubscribe = wsClient.onStatusChange((status) => {
      dispatch({ type: 'SET_WS_STATUS', payload: status });
    });

    return () => {
      disconnectWebSocket();
      unsubscribe();
    };
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    loadDevices,
    loadGroups,
    connectWebSocket,
    disconnectWebSocket,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppProvider');
  }
  return context;
}

