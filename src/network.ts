import Peer, { type DataConnection } from 'peerjs';

export type NetworkEvent = 
  | { type: 'INIT_STATE', state: any }
  | { type: 'SET_VALUE', index: number, value: number | null }
  | { type: 'TOGGLE_NOTE', index: number, value: number, player: 'p1' | 'p2' }
  | { type: 'CURSOR_MOVE', index: number | null }
  | { type: 'RESTART', difficulty: 'easy' | 'medium' | 'hard' };

export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public isHost: boolean = false;
  
  public onEvent: (event: NetworkEvent) => void = () => {};
  public onConnect: () => void = () => {};
  public onDisconnect: () => void = () => {};
  public onError: (err: any) => void = () => {};

  constructor() {}

  async hostGame(): Promise<string> {
    this.isHost = true;
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return new Promise((resolve, reject) => {
      this.peer = new Peer(`sudokoop-${roomId}`);
      
      this.peer.on('open', () => {
        resolve(roomId);
      });
      
      this.peer.on('error', (err) => {
        this.onError(err);
        reject(err);
      });

      this.peer.on('connection', (c) => {
        if (this.conn) {
          c.close();
          return;
        }
        this.conn = c;
        c.on('open', () => {
          this.setupConnection();
        });
      });
    });
  }

  async joinGame(roomId: string): Promise<void> {
    this.isHost = false;
    
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      
      this.peer.on('open', () => {
        const c = this.peer!.connect(`sudokoop-${roomId.toUpperCase()}`);
        
        c.on('open', () => {
          this.conn = c;
          this.setupConnection();
          resolve();
        });
        
        c.on('error', (err) => {
          this.onError(err);
          reject(err);
        });
      });
      
      this.peer.on('error', (err) => {
        this.onError(err);
        reject(err);
      });
    });
  }

  private setupConnection() {
    if (!this.conn) return;
    
    this.onConnect();
    
    this.conn.on('data', (data: any) => {
      this.onEvent(data as NetworkEvent);
    });
    
    this.conn.on('close', () => {
      this.onDisconnect();
      this.conn = null;
    });
  }

  send(event: NetworkEvent) {
    if (this.conn && this.conn.open) {
      this.conn.send(event);
    }
  }
}
