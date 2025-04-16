import { get_db_connection } from '../models/rdbms.js';

const db = get_db_connection();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

// mock users
const TEST_USERS = [
  { username: 'testuser1', password: 'password123', linked_nconst: 'nm0000122' },
  { username: 'testuser2', password: 'password123', linked_nconst: 'nm0000779' },
  { username: 'testuser3', password: 'password123', linked_nconst: 'nm0003424' }
];

let testUserIds = [];
let testRoomId = null;

// test!
describe('Chat Functionality Tests', () => {
  
  // before any tests run, we want to create the users
  beforeAll(async () => {
    const db = get_db_connection();
    await db.connect();
    
    // insert users into database
    for (const user of TEST_USERS) {
      const [result] = await queryDatabase(`
        INSERT INTO users (username, hashed_password, linked_nconst) 
        VALUES (?, ?, ?)`, 
        [user.username, user.password, user.linked_nconst]
      );
      testUserIds.push(result.insertId);
    }
  });

  // remove users after tests run
  afterAll(async () => {
    for (const userId of testUserIds) {
      await queryDatabase(`DELETE FROM users WHERE user_id = ?`, [userId]);
    }
    const db = get_db_connection();
    db.close();
  });
  
  // test send_invite socket
  test('Send chat invite creates invitation in database', async () => {
    // Simulate socket.io send_invite event by writing directly to database
    const senderId = testUserIds[0];
    const receiverId = testUserIds[1];
    
    // Insert the invite
    const [result] = await queryDatabase(`
      INSERT INTO chat_invites (sender_id, receiver_id)
      VALUES (?, ?)
    `, [senderId, receiverId]);
    
    // Verify invite was created
    const [inviteCheck] = await queryDatabase(`
      SELECT * FROM chat_invites 
      WHERE sender_id = ? AND receiver_id = ?
    `, [senderId, receiverId]);
    
    expect(inviteCheck.length).toBeGreaterThan(0);
  });
  
  // Test acceptChatInvite
  test('Accept chat invite creates a new chat room and adds both users', async () => {
    const senderId = testUserIds[0];
    const receiverId = testUserIds[1];
    
    // Simulate the acceptChatInvite function
    const [inviteResult] = await queryDatabase(
      `SELECT * FROM chat_invites WHERE sender_id = ? AND receiver_id = ?`,
      [senderId, receiverId]
    );
    
    expect(inviteResult.length).toBeGreaterThan(0);
    
    // create new chat room
    const [roomResult] = await queryDatabase(
      `INSERT INTO chat_rooms (room_name, is_group_chat) VALUES (?, ?)`,
      [`Chat with testuser1`, false]
    );
    
    testRoomId = roomResult.insertId;
    
    // add users to chat room
    await queryDatabase(
      `INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)`,
      [testRoomId, receiverId]
    );
    
    await queryDatabase(
      `INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)`,
      [testRoomId, senderId]
    );
    
    // remove invite
    await queryDatabase(
      `DELETE FROM chat_invites WHERE sender_id = ? AND receiver_id = ?`,
      [senderId, receiverId]
    );
    
    // verify users in chat
    const [members] = await queryDatabase(
      `SELECT COUNT(*) as count FROM chat_members WHERE room_id = ?`,
      [testRoomId]
    );
    
    expect(members[0].count).toBe(2);
    
    // verify invite gone
    const [remainingInvites] = await queryDatabase(
      `SELECT COUNT(*) as count FROM chat_invites WHERE sender_id = ? AND receiver_id = ?`,
      [senderId, receiverId]
    );
    
    expect(remainingInvites[0].count).toBe(0);
  });
  
  // Test adding messages
  test('Add messages to chat room', async () => {
    // Simulate send_messag
    for (const userId of testUserIds.slice(0, 2)) {
      await queryDatabase(`
        INSERT INTO chat_messages (room_id, sender_id, content) 
        VALUES (?, ?, ?)`,
        [testRoomId, userId, `Test message from user ${userId}`]
      );
    }
    
    // Verify messages added
    const [messagesResult] = await queryDatabase(`
      SELECT COUNT(*) as count FROM chat_messages 
      WHERE room_id = ?`,
      [testRoomId]
    );
    
    expect(messagesResult[0].count).toBe(2);
  });
  
  // Test  leave_chat 
  test('Users leave chat and chat is deleted when empty', async () => {
    // Have users leave one by one (simulating leave_chat socket event)
    for (let i = 0; i < 2; i++) {
      const userId = testUserIds[i];
      
      // User leaves the chat
      await queryDatabase(`
        DELETE FROM chat_members 
        WHERE room_id = ? AND user_id = ?`,
        [testRoomId, userId]
      );
      
      // Check remaining members
      const [remainingResult] = await queryDatabase(`
        SELECT COUNT(*) as count FROM chat_members 
        WHERE room_id = ?`,
        [testRoomId]
      );
      
      const expectedRemaining = 2 - (i + 1);
      expect(remainingResult[0].count).toBe(expectedRemaining);
      
      // if this was the last user, cleanup
      if (i === 1) {
        // Check if chat_members is empty
        const [membersResult] = await queryDatabase(`
          SELECT COUNT(*) as count FROM chat_members 
          WHERE room_id = ?`,
          [testRoomId]
        );
        expect(membersResult[0].count).toBe(0);
        
        // delete messages and room
        await queryDatabase(`DELETE FROM chat_messages WHERE room_id = ?`, [testRoomId]);
        await queryDatabase(`DELETE FROM chat_rooms WHERE room_id = ?`, [testRoomId]);
        
        // verify room gone
        const [roomResult] = await queryDatabase(`
          SELECT COUNT(*) as count FROM chat_rooms 
          WHERE room_id = ?`,
          [testRoomId]
        );
        expect(roomResult[0].count).toBe(0);
        
        // verify messages gone
        const [messageResult] = await queryDatabase(`
          SELECT COUNT(*) as count FROM chat_messages 
          WHERE room_id = ?`,
          [testRoomId]
        );
        expect(messageResult[0].count).toBe(0);
      }
    }
  });
});