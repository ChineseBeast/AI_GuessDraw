import { useEffect, useState, useCallback, useRef } from 'react';
import type { SocketService} from '../services/socket.service';
import { createSocketService, getSocketService } from '../services/socket.service';

interface UseSocketOptions {
  serverUrl: string;
  userId: string;
  nickname: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions) {
  const { serverUrl, userId, nickname, autoConnect = true } = options;
  const [connected, setConnected] = useState(false);
  const serviceRef = useRef<SocketService | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const service = createSocketService(serverUrl, userId, nickname);
    serviceRef.current = service;

    const unsubscribe = service.on('connect', () => {
      setConnected(true);
    });

    // Also listen for disconnect via the service
    const unsubDisconnect = service.on('disconnect', () => {
      setConnected(false);
    });

    setConnected(service.connected);

    return () => {
      unsubscribe();
      unsubDisconnect();
    };
  }, [serverUrl, userId, nickname, autoConnect]);

  const emit = useCallback(<T extends Record<string, unknown>>(event: string, payload?: T) => {
    const service = serviceRef.current || getSocketService();
    if (!service) return;

    switch (event) {
      case 'create_room':
        service.createRoom(payload as unknown as { maxPlayers: number; difficulty: 'easy' | 'medium' | 'hard' });
        break;
      case 'join_room':
        service.joinRoom(payload as unknown as { inviteCode: string });
        break;
      case 'leave_room':
        service.leaveRoom();
        break;
      case 'start_game':
        service.startGame();
        break;
      case 'canvas_action':
        service.canvasAction(payload as unknown as { type: 'draw' | 'erase' | 'undo' | 'clear'; brush?: { color: string; size: number; opacity: number }; points?: { x: number; y: number }[] });
        break;
      case 'submit_guess':
        service.submitGuess(payload as unknown as { text: string });
        break;
      case 'reconnect':
        service.reconnect(payload as unknown as { roomId: string; sessionToken: string });
        break;
    }
  }, []);

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    const service = serviceRef.current || getSocketService();
    if (!service) {
      return () => {
        // no-op: service not available
      };
    }
    return service.on<T>(event, handler);
  }, []);

  return { connected, emit, on, socketId: serviceRef.current?.socketId };
}
