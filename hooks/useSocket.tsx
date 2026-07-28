import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
    isReconnecting: boolean;
}

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    isConnected: false,
    isReconnecting: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        let isUnmounted = false;

        const initSocket = async () => {
            try {
                const res = await fetch('/api/patient/chat/token');
                const data = await res.json();
                const token = data.token;

                if (!token || isUnmounted) return;

                const newSocket = io(API_URL!, {
                    query: { token },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 30000,
                });

                newSocket.on('connect', () => {
                    if (!isUnmounted) {
                        setIsConnected(true);
                        setIsReconnecting(false);
                    }
                });

                newSocket.on('disconnect', () => {
                    if (!isUnmounted) {
                        setIsConnected(false);
                    }
                });

                newSocket.io.on('reconnect_attempt', () => {
                    if (!isUnmounted) setIsReconnecting(true);
                });

                newSocket.io.on('reconnect', () => {
                    if (!isUnmounted) {
                        setIsReconnecting(false);
                        setIsConnected(true);
                    }
                });

                newSocket.io.on('reconnect_error', () => {
                    if (!isUnmounted) setIsReconnecting(true);
                });

                socketRef.current = newSocket;
                if (!isUnmounted) setSocket(newSocket);
            } catch (err) {
                console.error('Failed to init socket', err);
            }
        };

        initSocket();

        return () => {
            isUnmounted = true;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
