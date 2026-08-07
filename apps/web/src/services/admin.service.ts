const API_BASE = '/api/admin';

export const AdminService = {
  getToken(): string | null {
    return localStorage.getItem('draw_guess_token');
  },

  authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async getDashboard(): Promise<{
    stats: {
      users: { total: number; admins: number; newToday: number };
      rooms: { active: number; playing: number; waiting: number };
      games: { totalPlayed: number; totalWins: number };
      leaderboard: { weeklyCount: number; monthlyCount: number; allTimeCount: number };
    };
  }> {
    const res = await fetch(`${API_BASE}/dashboard`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error('获取统计失败');
    return res.json();
  },

  async getUsers(limit = 100, offset = 0): Promise<{
    users: {
      id: string; username: string; email?: string; avatar?: string; role: string;
      createdAt: string; updatedAt: string;
      stats: { gamesPlayed: number; gamesWon: number; totalScore: number; currentStreak: number };
    }[];
    total: number;
  }> {
    const res = await fetch(`${API_BASE}/users?limit=${limit}&offset=${offset}`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error('获取用户列表失败');
    return res.json();
  },

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE', headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error('删除用户失败');
  },

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) throw new Error('重置密码失败');
  },

  async setUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('修改角色失败');
  },

  async getRooms(): Promise<{
    rooms: {
      id: string; inviteCode: string; hostId: string; status: string;
      maxPlayers: number; difficulty: string; createdAt: string;
      playerCount: number; spectatorCount: number;
    }[];
    total: number;
  }> {
    const res = await fetch(`${API_BASE}/rooms`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error('获取房间列表失败');
    return res.json();
  },

  async closeRoom(roomId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
      method: 'DELETE', headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error('关闭房间失败');
  },

  async getWords(): Promise<{ words: { easy: string[]; medium: string[]; hard: string[] } }> {
    const res = await fetch(`${API_BASE}/words`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error('获取词库失败');
    return res.json();
  },

  async addWord(difficulty: string, word: string): Promise<{ words: { easy: string[]; medium: string[]; hard: string[] } }> {
    const res = await fetch(`${API_BASE}/words`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ difficulty, word }),
    });
    if (!res.ok) throw new Error('添加词汇失败');
    return res.json();
  },

  async addWordsBatch(difficulty: string, words: string[]): Promise<{ added: number; skipped: number }> {
    const res = await fetch(`${API_BASE}/words/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ difficulty, words }),
    });
    if (!res.ok) throw new Error('批量添加失败');
    return res.json();
  },

  async removeWord(difficulty: string, word: string): Promise<void> {
    const res = await fetch(`${API_BASE}/words/${difficulty}/${encodeURIComponent(word)}`, {
      method: 'DELETE', headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error('删除词汇失败');
  },
};
