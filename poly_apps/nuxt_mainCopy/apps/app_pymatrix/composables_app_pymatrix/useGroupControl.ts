import { ref } from 'vue';
import { useWSRPC } from '@/composables/useWSRPC';
import { useGroupStore } from '../stores_app_pymatrix/groupStore';
import type { GroupState, WSRPCMessage } from '@/types/pymatrix';

interface UseGroupControlOptions {
  baseUrl: string;
}

export function useGroupControl(options: UseGroupControlOptions) {
  const connected = ref(false);
  const groupStore = useGroupStore();

  const wsUrl = `${options.baseUrl}/ws/group`;

  const { connect: connectWS, disconnect: disconnectWS, sendMessage, connected: wsConnected } = useWSRPC({
    url: wsUrl,
    onMessage: handleMessage,
    onConnect: () => {
      connected.value = true;
    },
    onDisconnect: () => {
      connected.value = false;
    },
    onError: (error) => {
      console.error('Group control WebSocket error:', error);
    }
  });

  function handleMessage(message: WSRPCMessage) {
    const { type, data } = message;

    switch (type) {
      case 'group.connected':
        console.log('Group control connected:', data);
        break;

      case 'group.created':
        console.log('Group created:', data);
        break;

      case 'group.slave_added':
        console.log('Slave added:', data);
        break;

      case 'group.slave_removed':
        console.log('Slave removed:', data);
        break;

      case 'group.enabled':
        console.log('Group enabled:', data);
        groupStore.enableGroup();
        break;

      case 'group.disabled':
        console.log('Group disabled:', data);
        groupStore.disableGroup();
        break;

      case 'group.state':
      case 'group.state_update':
        if (data.state) {
          groupStore.updateGroupState(data.state as GroupState);
        }
        break;

      case 'group.broadcast_complete':
        console.log('Touch broadcast complete:', data);
        break;

      case 'error':
        console.error('Group control error:', data);
        break;
    }
  }

  function createGroup(groupId: string, hostSerial: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.create',
      timestamp: Date.now(),
      data: {
        groupId,
        hostSerial
      }
    });
  }

  function addSlave(groupId: string, slaveSerial: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.add_slave',
      timestamp: Date.now(),
      data: {
        groupId,
        slaveSerial
      }
    });
  }

  function removeSlave(groupId: string, slaveSerial: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.remove_slave',
      timestamp: Date.now(),
      data: {
        groupId,
        slaveSerial
      }
    });
  }

  function enableGroup(groupId: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.enable',
      timestamp: Date.now(),
      data: {
        groupId
      }
    });
  }

  function disableGroup(groupId: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.disable',
      timestamp: Date.now(),
      data: {
        groupId
      }
    });
  }

  function getGroupState(groupId: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.get_state',
      timestamp: Date.now(),
      data: {
        groupId
      }
    });
  }

  function broadcastTouch(
    hostSerial: string,
    action: 'down' | 'up' | 'move',
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number
  ) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'group.broadcast_touch',
      timestamp: Date.now(),
      data: {
        hostSerial,
        action,
        x,
        y,
        screenWidth,
        screenHeight
      }
    });
  }

  function connect() {
    connectWS();
  }

  function disconnect() {
    disconnectWS();
  }

  return {
    connected,
    connect,
    disconnect,
    createGroup,
    addSlave,
    removeSlave,
    enableGroup,
    disableGroup,
    getGroupState,
    broadcastTouch
  };
}
