import { Test, TestingModule } from '@nestjs/testing';
import { RoomManagerService } from './room-manager.service';

// Mock nanoid ESM module
jest.mock('nanoid', () => ({
  customAlphabet: () => () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
}));

describe('RoomManagerService', () => {
  let service: RoomManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomManagerService],
    }).compile();

    service = module.get<RoomManagerService>(RoomManagerService);
  });

  describe('createRoom', () => {
    it('should create a room with the host as first player', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');

      expect(room).toBeDefined();
      expect(room.hostId).toBe('u1');
      expect(room.status).toBe('waiting');
      expect(room.maxPlayers).toBe(4);
      expect(room.difficulty).toBe('easy');
      expect(room.players.size).toBe(1);
      expect(room.players.has('u1')).toBe(true);
      expect(room.players.get('u1')!.nickname).toBe('Alice');
      expect(room.inviteCode).toBeDefined();
      expect(room.inviteCode.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate unique invite codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const room = service.createRoom(`u${i}`, `Player${i}`, 4, 'easy');
        codes.add(room.inviteCode);
      }
      expect(codes.size).toBe(50);
    });

    it('should assign a session token to the host', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const host = room.players.get('u1')!;
      expect(host.sessionToken).toBeDefined();
      expect(host.sessionToken.length).toBeGreaterThan(10);
    });
  });

  describe('findByInviteCode', () => {
    it('should find a room by invite code (case-insensitive)', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const found = service.findByInviteCode(room.inviteCode.toLowerCase());
      expect(found).toBeDefined();
      expect(found!.id).toBe(room.id);
    });

    it('should return undefined for non-existent invite code', () => {
      const found = service.findByInviteCode('ZZZZZZ');
      expect(found).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should find a room by ID', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const found = service.findById(room.id);
      expect(found).toBeDefined();
      expect(found!.inviteCode).toBe(room.inviteCode);
    });

    it('should return undefined for non-existent ID', () => {
      const found = service.findById('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('joinRoom', () => {
    it('should add a player to the room', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const { player, isSpectator } = service.joinRoom(room, 'u2', 'Bob', 'socket_2');

      expect(isSpectator).toBe(false);
      expect(player.userId).toBe('u2');
      expect(player.nickname).toBe('Bob');
      expect(player.role).toBe('guesser');
      expect(player.socketId).toBe('socket_2');
      expect(room.players.size).toBe(2);
      expect(room.players.has('u2')).toBe(true);
    });

    it('should join as spectator when game is in progress', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      room.status = 'playing';
      const { isSpectator, player } = service.joinRoom(room, 'u2', 'Bob', 'socket_2');

      expect(isSpectator).toBe(true);
      expect(player.role).toBe('spectator');
      expect(room.players.has('u2')).toBe(false);
      expect(room.spectators.has('u2')).toBe(true);
    });

    it('should throw ROOM_FULL when at capacity', () => {
      const room = service.createRoom('u1', 'Alice', 2, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');

      expect(() => {
        service.joinRoom(room, 'u3', 'Charlie', 'socket_3');
      }).toThrow('ROOM_FULL');
      expect(room.players.size).toBe(2);
    });

    it('should throw ALREADY_IN_ROOM for duplicate player', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');

      expect(() => {
        service.joinRoom(room, 'u2', 'Bob2', 'socket_2b');
      }).toThrow('ALREADY_IN_ROOM');
    });

    it('should throw ALREADY_IN_ROOM if player is already a spectator', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      room.status = 'playing';
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');

      expect(() => {
        service.joinRoom(room, 'u2', 'Bob2', 'socket_2b');
      }).toThrow('ALREADY_IN_ROOM');
    });
  });

  describe('leaveRoom', () => {
    it('should remove a player from the room', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');
      service.leaveRoom(room.id, 'u2');

      expect(room.players.size).toBe(1);
      expect(room.players.has('u2')).toBe(false);
    });

    it('should transfer host when host leaves', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');
      service.leaveRoom(room.id, 'u1');

      expect(room.hostId).toBe('u2');
    });

    it('should not transfer host if non-host leaves', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');
      service.leaveRoom(room.id, 'u2');

      expect(room.hostId).toBe('u1');
    });

    it('should remove spectator from room', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      room.status = 'playing';
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');
      expect(room.spectators.has('u2')).toBe(true);

      service.leaveRoom(room.id, 'u2');
      expect(room.spectators.has('u2')).toBe(false);
    });
  });

  describe('markDisconnected / markReconnected', () => {
    it('should mark a player as disconnected', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const player = service.markDisconnected(room.id, 'u1');

      expect(player).toBeDefined();
      expect(player!.connectionStatus).toBe('disconnected');
      expect(player!.disconnectedAt).toBeDefined();
    });

    it('should mark a player as reconnected', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.markDisconnected(room.id, 'u1');
      const player = service.markReconnected(room.id, 'u1', 'new_socket');

      expect(player).toBeDefined();
      expect(player!.connectionStatus).toBe('connected');
      expect(player!.disconnectedAt).toBeUndefined();
      expect(player!.socketId).toBe('new_socket');
    });

    it('should return undefined for non-existent player', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const result = service.markDisconnected(room.id, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('updatePlayerSocket', () => {
    it('should update a player socket ID', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.updatePlayerSocket(room.id, 'u1', 'socket_updated');

      expect(room.players.get('u1')!.socketId).toBe('socket_updated');
    });

    it('should not throw for non-existent room', () => {
      expect(() => service.updatePlayerSocket('bad_id', 'u1', 's')).not.toThrow();
    });
  });

  describe('validateSession', () => {
    it('should validate a correct session token', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const token = room.players.get('u1')!.sessionToken;
      expect(service.validateSession(room.id, 'u1', token)).toBe(true);
    });

    it('should reject an incorrect session token', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      expect(service.validateSession(room.id, 'u1', 'wrong_token')).toBe(false);
    });

    it('should reject for non-existent room', () => {
      expect(service.validateSession('bad_room', 'u1', 'token')).toBe(false);
    });
  });

  describe('getAllPlayers', () => {
    it('should return players and spectators', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      service.joinRoom(room, 'u2', 'Bob', 'socket_2');
      room.status = 'playing';
      service.joinRoom(room, 'u3', 'Charlie', 'socket_3');

      const all = service.getAllPlayers(room);
      expect(all.length).toBe(3);
    });
  });

  describe('removeRoom', () => {
    it('should remove the room and its invite code mapping', () => {
      const room = service.createRoom('u1', 'Alice', 4, 'easy');
      const code = room.inviteCode;
      service.removeRoom(room.id);

      expect(service.findById(room.id)).toBeUndefined();
      expect(service.findByInviteCode(code)).toBeUndefined();
    });
  });
});
