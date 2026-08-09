import { useState, useCallback, useEffect } from 'react';
import type {
  RoomCreatedResponse,
  RoomJoinedResponse,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  HostChangedEvent,
  ErrorEvent,
  WSPlayerInfo,
} from '@draw-guess/shared';

interface RoomState {
  roomId: string;
  inviteCode: string;
  hostId: string;
  status: string;
  maxPlayers: number;
  difficulty: string;
  players: WSPlayerInfo[];
}

interface UseRoomOptions {
  on: <T>(event: string, handler: (data: T) => void) => () => void;
  emit: (event: string, payload?: Record<string, unknown>) => void;
}

export function useRoom({ on, emit }: UseRoomOptions) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for room events
  useEffect(() => {
    const unsub1 = on<RoomCreatedResponse>('room_created', (data) => {
      setRoom({
        roomId: data.roomId,
        inviteCode: data.inviteCode,
        hostId: data.hostId,
        status: 'waiting',
        maxPlayers: data.maxPlayers,
        difficulty: data.difficulty,
        players: data.players as WSPlayerInfo[],
      });
      setError(null);
    });

    const unsub2 = on<RoomJoinedResponse>('room_joined', (data) => {
      setRoom({
        roomId: data.roomId,
        inviteCode: data.inviteCode,
        hostId: data.hostId,
        status: data.status,
        maxPlayers: data.maxPlayers,
        difficulty: data.difficulty,
        players: data.players as WSPlayerInfo[],
      });
      setError(null);
    });

    const unsub3 = on<PlayerJoinedEvent>('player_joined', (data) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: [...prev.players, data.player as WSPlayerInfo],
        };
      });
    });

    const unsub4 = on<PlayerLeftEvent>('player_left', (data) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.userId !== data.playerId),
        };
      });
    });

    const unsub5 = on<PlayerDisconnectedEvent>('player_disconnected', (data) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p =>
            p.userId === data.playerId ? { ...p, connectionStatus: 'disconnected' } : p
          ),
        };
      });
    });

    const unsub6 = on<PlayerReconnectedEvent>('player_reconnected', (data) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p =>
            p.userId === data.playerId ? { ...p, connectionStatus: 'connected' } : p
          ),
        };
      });
    });

    const unsub7 = on<HostChangedEvent>('host_changed', (data) => {
      setRoom(prev => {
        if (!prev) return prev;
        return { ...prev, hostId: data.newHostId };
      });
    });

    const unsub8 = on<ErrorEvent>('error', (data) => {
      setError(data.message);
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
      unsub5(); unsub6(); unsub7(); unsub8();
    };
  }, [on]);

  const createRoom = useCallback((maxPlayers: number, difficulty: string, allowAI = false) => {
    emit('create_room', { maxPlayers, difficulty, allowAI } as unknown as Record<string, unknown>);
  }, [emit]);

  const joinRoom = useCallback((inviteCode: string) => {
    emit('join_room', { inviteCode } as unknown as Record<string, unknown>);
  }, [emit]);

  const leaveRoom = useCallback(() => {
    emit('leave_room');
    setRoom(null);
  }, [emit]);

  const startGame = useCallback(() => {
    emit('start_game');
  }, [emit]);

  const isHost = room ? room.hostId : false;

  return {
    room,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    isHost,
    clearError: () => setError(null),
  };
}
