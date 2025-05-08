import express from 'express';
import fs from 'fs';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import { get_db_connection } from './models/rdbms.js';

import register_routes from './routes/register_routes.js';
import session from 'express-session';

const configFile = fs.readFileSync('config.json', 'utf8');
import dotenv from 'dotenv';
dotenv.config();
const config = JSON.parse(configFile);

const app = express();
const port = config.serverPort;
const server = http.createServer(app);

var host = process.env.SITE_HOST; // Use SITE_HOST from .env
// host = null;

// set up socket io
const io = new Server(server, {
    cors: {
        origin: host == null ? 'http://localhost:4567' : host,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

const db = get_db_connection();

// Connection handling for server socket
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // when user logs in add them to online users
    socket.on('user_connect', async (userId) => {
        console.log(`User ${userId} is now online`);
        try {
            // Delete any existing entries for this user (if previous disconnect did not work)
            await queryDatabase('DELETE FROM online_users WHERE user_id = ?', [
                userId,
            ]);

            // User is online now (may need to convert this functionality over to socket later)
            await queryDatabase(
                'INSERT INTO online_users (user_id, socket_id) VALUES (?, ?)',
                [userId, socket.id]
            );

            const [rows] = await queryDatabase(
                'SELECT user_id FROM online_users'
            );
            const onlineList = rows.map((r) => r.user_id);

            // 3) broadcast both the full list and the single‐user join
            io.emit('onlineUsers', onlineList);
            io.emit('userOnline', userId);
            console.log(
                `User ${userId} is now online with socket ID ${socket.id}`
            );

            localStorage.setItem('userId', userId);
        } catch (err) {
            console.error('Database error:', err);
        }
    });

    // Join a chat room
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Send a message
    socket.on('send_message', async (data) => {
        const roomId = data.roomId;
        const senderId = data.senderId;
        const content = data.content;

        try {
            const numericRoomId = parseInt(roomId, 10);

            // Check if we have a valid room ID
            if (isNaN(numericRoomId)) {
                console.warn(`Invalid room ID format: ${roomId}`);
                socket.emit('error', { message: 'Invalid room ID format' });
                return;
            }

            // Save message to database
            const query = `
        INSERT INTO chat_messages (room_id, sender_id, content)
        VALUES (?, ?, ?)
      `;
            await queryDatabase(query, [numericRoomId, senderId, content]);

            // Get sender's username
            const userQuery = `SELECT username FROM users WHERE user_id = ?`;
            const [userResult] = await queryDatabase(userQuery, [senderId]);
            const username = userResult[0]?.username || 'Unknown User';

            // Broadcast message to everyone in the room
            io.to(numericRoomId).emit('new_message', {
                senderId,
                username,
                content,
                roomId: numericRoomId,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Send chat invitation
    socket.on('send_invite', async (data) => {
        const senderId = data.senderId;
        const receiverId = data.receiverId;
        const roomId = data.roomId;

        try {
            const query = `
        INSERT INTO chat_invites (sender_id, receiver_id, room_id)
        VALUES (?, ?, ?)
      `;
            const result = await queryDatabase(query, [
                senderId,
                receiverId,
                roomId,
            ]);
            const inviteId = result.insertId;

            // get the username of the sender
            const userQuery = `SELECT username FROM users WHERE user_id = ?`;
            const [userResult] = await queryDatabase(userQuery, [senderId]);
            const senderUsername = userResult[0]?.username || 'Unknown User';

            // check if receiver is onlien to send the invitation
            const [receiverResults] = await queryDatabase(
                'SELECT socket_id FROM online_users WHERE user_id = ?',
                [receiverId]
            );
            if (receiverResults && receiverResults.length > 0) {
                const receiverSocketId = receiverResults[0].socket_id;
                console.log(
                    `Sending chat invite to socket ID: ${receiverSocketId}`
                );

                // send notification of invite
                io.to(receiverSocketId).emit('chat_invite', {
                    inviteId,
                    senderId,
                    senderUsername,
                });
            }
        } catch (error) {
            console.error('Error sending invite:', error);
            socket.emit('error', { message: 'Failed to send invitation' });
        }
    });

    // Leave a chat
    socket.on('leave_chat', async (data) => {
        const userId = data.userId;
        const roomId = data.roomId;

        try {
            // Remove user from chat members
            await queryDatabase(
                `DELETE FROM chat_members WHERE room_id = ? AND user_id = ?`,
                [roomId, userId]
            );

            // Check if chat is now empty
            const [countResult] = await queryDatabase(
                `SELECT COUNT(*) as count FROM chat_members WHERE room_id = ?`,
                [roomId]
            );

            if (countResult[0].count === 0) {
                // delete chat and messages if no members left
                await queryDatabase(
                    `DELETE FROM chat_messages WHERE room_id = ?`,
                    [roomId]
                );
                await queryDatabase(
                    `DELETE FROM chat_rooms WHERE room_id = ?`,
                    [roomId]
                );
            }

            // Have socket leave the room
            socket.leave(roomId);
        } catch (error) {
            console.error('Error leaving chat:', error);
            socket.emit('error', { message: 'Failed to leave chat' });
        }
    });

    // Invite to group chat
    socket.on('invite_to_group', async (data) => {
        const roomId = data.roomId;
        const senderId = data.senderId;
        const receiverId = data.receiverId;

        try {
            // Check if receiver is already in the room
            const [memberCheck] = await queryDatabase(
                `SELECT * FROM chat_members WHERE room_id = ? AND user_id = ?`,
                [roomId, receiverId]
            );

            if (memberCheck.length > 0) {
                socket.emit('error', {
                    message: 'User is already in this chat',
                });
                return;
            }

            // Make sure this is a group chat (this might not be necessary later though, could delete this and below)
            const [roomCheck] = await queryDatabase(
                `SELECT is_group_chat FROM chat_rooms WHERE room_id = ?`,
                [roomId]
            );

            if (!roomCheck[0].is_group_chat) {
                // Convert to group chat if it's not already
                await queryDatabase(
                    `UPDATE chat_rooms SET is_group_chat = true WHERE room_id = ?`,
                    [roomId]
                );
            }

            // Create invitation
            const [inviteResult] = await queryDatabase(
                `INSERT INTO chat_invites (sender_id, receiver_id, room_id) VALUES (?, ?, ?)`,
                [senderId, receiverId, roomId]
            );

            // Get sender username and room name
            const [userResult] = await queryDatabase(
                `SELECT username FROM users WHERE user_id = ?`,
                [senderId]
            );

            // check if receiver is onlien to send the invitation
            const [receiverResults] = await queryDatabase(
                'SELECT socket_id FROM online_users WHERE user_id = ?',
                [receiverId]
            );
            if (receiverResults && receiverResults.length > 0) {
                const receiverSocketId = receiverResults[0].socket_id;
                console.log(
                    `Sending chat invite to socket ID: ${receiverSocketId}`
                );

                // send invite to receiver
                io.to(receiverSocketId).emit('chat_invite', {
                    senderId,
                    senderUsername: userResult[0]?.username,
                });
            }
        } catch (error) {
            console.error('Error sending group invite:', error);
            socket.emit('error', {
                message: 'Failed to send group invitation',
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        try {
            const [res] = await queryDatabase(
                'SELECT user_id FROM online_users WHERE socket_id = ?',
                [socket.id]
            );
            // Remove user from online_users table
            await queryDatabase(
                'DELETE FROM online_users WHERE socket_id = ?',
                [socket.id]
            );
            const [afterRows] = await queryDatabase(
                'SELECT user_id FROM online_users'
            );
            const afterList = afterRows.map((r) => r.user_id);
            io.emit('onlineUsers', afterList);
            console.log(res);
            io.emit('userOffline', res[0].user_id);
            console.log('User disconnected', res[0].user_id);

            localStorage.removeItem('userId');
        } catch (err) {
            console.error('Database error:', err);
        }
    });
});

app.use(
    cors({
        origin: host == null ? 'http://localhost:4567' : host,
        methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
        credentials: true,
    })
);
app.use(express.json());
app.use(
    session({
        secret: 'nets2120_insecure',
        saveUninitialized: true,
        cookie: { httpOnly: false },
        resave: true,
    })
);

import cron from 'node-cron';
import { runComputeRanks } from './algorithms/run_compute_ranks.js'; // adjust path as needed

// Schedule the job to run at the top of every hour
// okay it's actually every 5 min for now lol
cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running Compute Ranks Jobs...');

    try {
        const output = await runComputeRanks();
        console.log('[CRON] Job finished:', output);
    } catch (err) {
        console.error('[CRON] Job failed:', err);
    }
});

register_routes(app);

// app.listen(port, () => {
//   console.log(`Main app listening on port ${port}`)
// })

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
