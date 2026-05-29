import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { db } from "../../models";

export interface AuthenticatedSocket {
  id: string;
  user: {
    id: string;
    businessId: string;
    fullName: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  to: (room: string) => any;
  broadcast: any;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, AuthenticatedSocket>();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
        const userId = decoded.sub;

        const user = await db.User.findByPk(userId, {
          include: [
            {
              model: db.Role,
              through: { attributes: [] },
              include: [{ model: db.Permission, through: { attributes: [] } }],
            },
          ],
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        const roles = (user.Roles || []).map((r: any) => r.key);
        const permissions = new Set<string>();
        (user.Roles || []).forEach((r: any) => {
          (r.Permissions || []).forEach((p: any) => permissions.add(p.key));
        });

        socket.user = {
          id: user.id,
          businessId: user.businessId,
          fullName: user.fullName,
          email: user.email,
          roles,
          permissions: Array.from(permissions),
        };

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user.fullName} connected to WebSocket`);
      
      // Store connected user
      this.connectedUsers.set(socket.user.id, socket);
      
      // Join business room for business-wide notifications
      socket.join(`business:${socket.user.businessId}`);
      
      // Join user-specific room
      socket.join(`user:${socket.user.id}`);

      // Handle interview room joining
      socket.on('join-interview', (interviewId: string) => {
        socket.join(`interview:${interviewId}`);
      });

      socket.on('leave-interview', (interviewId: string) => {
        socket.leave(`interview:${interviewId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user.fullName} disconnected from WebSocket`);
        this.connectedUsers.delete(socket.user.id);
      });
    });
  }

  // Notify specific user
  public notifyUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Notify all users in a business
  public notifyBusiness(businessId: string, event: string, data: any) {
    this.io.to(`business:${businessId}`).emit(event, data);
  }

  // Notify interview participants
  public notifyInterview(interviewId: string, event: string, data: any) {
    this.io.to(`interview:${interviewId}`).emit(event, data);
  }

  // Notify multiple users
  public notifyUsers(userIds: string[], event: string, data: any) {
    userIds.forEach(userId => {
      this.notifyUser(userId, event, data);
    });
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Check if user is online
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

let socketService: SocketService;

export const initializeSocket = (server: HTTPServer): SocketService => {
  socketService = new SocketService(server);
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
};