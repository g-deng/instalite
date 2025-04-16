import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { get_db_connection } from '../models/rdbms.js';

const db = get_db_connection();

async function queryDatabase(query, params = []) {
  await db.connect();
  
  return db.send_sql(query, params);
}

const TEST_USERS = [
  { username: 'testuser1', password: 'password123', linked_nconst: 'nm0000122' },
  { username: 'testuser2', password: 'password123', linked_nconst: 'nm0000779' }
];

let testUserIds = [];
let testRoomId = null;

describe('Socket.io Chat Tests', () => {
  let io, serverSocket, user1, user2;
  let httpServer;

  beforeAll(async () => {
    await db.connect();
    
    // insert our test users
    for (const user of TEST_USERS) {
      const [result] = await queryDatabase(`
        INSERT INTO users (username, hashed_password, linked_nconst) 
        VALUES (?, ?, ?)`, 
        [user.username, user.password, user.linked_nconst]
      );
      testUserIds.push(result.insertId);
    }
    
    // create a test room
    const [roomResult] = await queryDatabase(`
      INSERT INTO chat_rooms (room_name, is_group_chat) 
      VALUES (?, ?)`,
      ['Test Room', false]
    );
    
    testRoomId = roomResult.insertId;
    
    // add users to room
    await queryDatabase(`
      INSERT INTO chat_members (room_id, user_id) 
      VALUES (?, ?)`,
      [testRoomId, testUserIds[0]]
    );
    
    await queryDatabase(`
      INSERT INTO chat_members (room_id, user_id) 
      VALUES (?, ?)`,
      [testRoomId, testUserIds[1]]
    );
  });

  afterAll(async () => {
    // clean up database after we are done
    await queryDatabase(`DELETE FROM chat_members WHERE room_id = ?`, [testRoomId]);
    await queryDatabase(`DELETE FROM chat_messages WHERE room_id = ?`, [testRoomId]);
    await queryDatabase(`DELETE FROM chat_rooms WHERE room_id = ?`, [testRoomId]);
    
    for (const userId of testUserIds) {
      await queryDatabase(`DELETE FROM users WHERE user_id = ?`, [userId]);
    }
    
    db.close();
  });

  beforeEach((done) => {
    // create http server and socket server for our tests
    httpServer = createServer();
    io = new Server(httpServer);
    
    io.on('connection', (socket) => {
      serverSocket = socket;
      
      socket.on('join_room', (roomId) => {
        socket.join(roomId);
      });
      
      socket.on('send_message', async (data) => {
        const { roomId, senderId, content } = data;
        
        try {
          // Save message to database
          await queryDatabase(`
            INSERT INTO chat_messages (room_id, sender_id, content)
            VALUES (?, ?, ?)
          `, [roomId, senderId, content]);
          
          // Get sender's username
          const [userResult] = await queryDatabase(`
            SELECT username FROM users WHERE user_id = ?
          `, [senderId]);
          
          const username = userResult[0]?.username || 'Unknown User';
          
          // Broadcast message
          io.to(roomId).emit('new_message', {
            senderId,
            username,
            content,
            roomId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error in test send_message:', error);
        }
      });
      
      socket.on('leave_chat', async (data) => {
        const { userId, roomId } = data;
        
        try {
          // remove users
          await queryDatabase(`
            DELETE FROM chat_members WHERE room_id = ? AND user_id = ?
          `, [roomId, userId]);
          
          // check if chat is empty after removing users
          const [countResult] = await queryDatabase(`
            SELECT COUNT(*) as count FROM chat_members WHERE room_id = ?
          `, [roomId]);
          
          if (countResult[0].count === 0) {
            // delete messages and room
            await queryDatabase(`DELETE FROM chat_messages WHERE room_id = ?`, [roomId]);
            await queryDatabase(`DELETE FROM chat_rooms WHERE room_id = ?`, [roomId]);
          }
          
          socket.leave(roomId);
          socket.emit('left_chat_success');
        } catch (error) {
          console.error('Error in test leave_chat:', error);
        }
      });
    });
    
    // Start the server
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // connect clients
      user1 = Client(`http://localhost:${port}`);
      user2 = Client(`http://localhost:${port}`);
      
      user1.on('connect', () => {
        user2.on('connect', done);
      });
    });
  });

  afterEach(() => {
    io.close();
    user1.close();
    user2.close();
    httpServer.close();
  });

  test('should send and receive messages', (done) => {
    const testMessage = 'Hello from test user';
    
    // have users join room
    user1.emit('join_room', testRoomId);
    user2.emit('join_room', testRoomId);
    
    // set up user2 to receive message
    user2.on('new_message', (message) => {
      expect(message.content).toBe(testMessage);
      expect(message.senderId).toBe(testUserIds[0]);
      
      // Verify message was saved to database
      queryDatabase(`
        SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT 1
      `, [testRoomId])
        .then(([result]) => {
          expect(result[0].content).toBe(testMessage);
          done();
        });
    });

    // wait a bit for users to join room just to avoid races
    setTimeout(() => {
      // user1 sends a message
      user1.emit('send_message', {
        roomId: testRoomId,
        senderId: testUserIds[0],
        content: testMessage
      });
    }, 100);
  });

  test('should handle leaving a chat', (done) => {
    // user1 leaves the chat
    user1.emit('leave_chat', {
      userId: testUserIds[0],   
      roomId: testRoomId
    });
    
    user1.on('left_chat_success', () => {
      // Verify user was removed from chat
      queryDatabase(`
        SELECT COUNT(*) as count FROM chat_members 
        WHERE room_id = ? AND user_id = ?
      `, [testRoomId, testUserIds[0]])
        .then(([result]) => {
          expect(result[0].count).toBe(0);
          done();
        });
    });
  });
});