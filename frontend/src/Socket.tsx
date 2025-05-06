// src/socket.ts
import { io, Socket } from 'socket.io-client';
import config from '../config.json';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(config.serverRootURL, { withCredentials: true });
    }
    return socket;
}

if (!socket) {
    socket = io(config.serverRootURL, { withCredentials: true });
}

socket.on('connect', () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        socket?.emit('user_connect', userId);
    }
});