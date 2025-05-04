import express from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';

import register_routes from '../routes/register_routes.js';
import { getFriends, getFriendRecs, addFriend, removeFriend } from '../routes/friend_routes.js';
import RouteHelper from '../routes/route_helper.js';
import {get_db_connection, set_db_connection, RelationalDB} from '../models/rdbms.js';
import session from 'express-session';

const configFile = fs.readFileSync('config.json', 'utf8');
import dotenv from 'dotenv';

dotenv.config();
const config = JSON.parse(configFile);

const port = parseInt(config.serverPort)+1;
var helper = new RouteHelper();

var db = new RelationalDB();
var db_initialized = 0;

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({secret: 'nets2120_insecure', saveUninitialized: true, resave: true}));

// register most routes
register_routes(app);

// register friend routes for testing
app.get('/:username/friends', getFriends);
app.get('/:username/recommendations', getFriendRecs);
app.post('/:username/addFriend', addFriend);
app.post('/:username/removeFriend', removeFriend);

var server = null;

// test user data in the form of endpoint expects
const testUsers = [
  { 
    username: 'test_friend1', 
    password: 'testpass1', 
    linked_id: 'nm0000122' 
  },
  { 
    username: 'test_friend2', 
    password: 'testpass2', 
    linked_id: 'nm0003424'
  }
];
let user1Id, user2Id;

async function send_sql(query, params = []) {
  try {
    const result = await db.send_sql(query, params);
    return result;
  } catch (error) {
    console.log('SQL Error:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    await db.connect();
    
    // get user ids of test users when inserted into table
    const existingUsers = await send_sql("SELECT user_id FROM users WHERE username IN (?, ?)", 
      [testUsers[0].username, testUsers[1].username]);
    
    if (existingUsers[0] && existingUsers[0].length > 0) {
      const userIds = existingUsers[0].map(u => u.user_id);
      
      // delete from friends table using the ids
      if (userIds.length > 0) {
        await send_sql("DELETE FROM friends WHERE follower IN (?) OR followed IN (?)", 
          [userIds, userIds]);
      }
      
      // delete the test users from the users table
      await send_sql("DELETE FROM users WHERE username IN (?, ?)", 
        [testUsers[0].username, testUsers[1].username]);
    }
  } catch (error) {
    console.log('Cleanup error:', error);
  }
}

beforeAll(async () => {
  await cleanupTestData();
  
  server = app.listen(port, () => {
    console.log(`Test server listening on port ${port}`);
  });
}, 20000);

afterAll(async () => {
  await cleanupTestData();
  
  await db.close();
  await new Promise(resolve => setTimeout(() => resolve(), 50)); // avoid jest open handle error
  server.close();
  console.log('Tests are completed. Closing server.');
});

describe('Friend Integration Tests', () => {
  test('Full signup, login, and friendship flow', async () => {
    try {
      // register two test users
      console.log('Registering first user...');
      console.log('Registration data:', testUsers[0]);
      
      const reg1 = await axios.post(`http://localhost:${port}/register`, {
        username: testUsers[0].username,
        password: testUsers[0].password,
        linked_id: testUsers[0].linked_id
      });
      
      expect(reg1.status).toBe(200);
      expect(reg1.data.message).toBeDefined();
      
      // extract the user id from the response message
      const userJson1 = JSON.parse(reg1.data.message.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
      user1Id = userJson1.user_id;
      
      console.log('First user registered with ID:', user1Id);
      
      // register second test user
      console.log('Registering second user...');
      const reg2 = await axios.post(`http://localhost:${port}/register`, {
        username: testUsers[1].username,
        password: testUsers[1].password,
        linked_id: testUsers[1].linked_id
      });
      
      expect(reg2.status).toBe(200);
      expect(reg2.data.message).toBeDefined();
      
      // again, extract the user id from the response message
      const userJson2 = JSON.parse(reg2.data.message.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
      user2Id = userJson2.user_id;
      
      console.log('Second user registered with ID:', user2Id);
      
      // verify the users were created and ids were returned
      expect(user1Id).toBeDefined();
      expect(user2Id).toBeDefined();
      
      // log in both users to get sessions
      console.log('Logging in first user...');
      const login1 = await axios.post(`http://localhost:${port}/login`, {
        username: testUsers[0].username,
        password: testUsers[0].password
      }, { withCredentials: true });
      
      expect(login1.status).toBe(200);
      const cookies1 = login1.headers['set-cookie'];
      console.log('First user logged in, cookies:', cookies1);
      
      console.log('Logging in second user...');
      const login2 = await axios.post(`http://localhost:${port}/login`, {
        username: testUsers[1].username,
        password: testUsers[1].password
      }, { withCredentials: true });
      
      expect(login2.status).toBe(200);
      const cookies2 = login2.headers['set-cookie'];
      console.log('Second user logged in, cookies:', cookies2);
      
      // user 1 adds user 2 as friend
      console.log('Adding friend relationship...');
      console.log(`POST http://localhost:${port}/${testUsers[0].username}/addFriend`);
      console.log('Request body:', { friendUsername: testUsers[1].username });
      console.log('Request headers:', { Cookie: cookies1 });
      
      const addFriend = await axios.post(`http://localhost:${port}/${testUsers[0].username}/addFriend`, {
        friendUsername: testUsers[1].username
      }, {
        headers: { Cookie: cookies1 },
        withCredentials: true
      });
      
      console.log('Add friend response:', addFriend.data);
      expect(addFriend.status).toBe(200);
      expect(addFriend.data.message).toBe('Friend added successfully.');
      
      // verify friendship in database
      console.log('Verifying friendship in database...');
      const friendships = await send_sql(
        `SELECT * FROM friends 
         WHERE (follower = ? AND followed = ?) 
            OR (follower = ? AND followed = ?)`,
        [user1Id, user2Id, user2Id, user1Id]
      );
      
      console.log('Friendship records:', friendships[0]);
      // should find two records (bidirectional friendship)
      expect(friendships[0].length).toBe(2);
      
      // check friendships through api for both users
      console.log("checking first user's friends list...");
      const friends1 = await axios.get(`http://localhost:${port}/${testUsers[0].username}/friends`, {
        headers: { Cookie: cookies1 },
        withCredentials: true
      });
      
      console.log("first user's friends:", friends1.data);
      expect(friends1.status).toBe(200);
      expect(friends1.data.results.some(f => 
        f.user_id === user2Id || 
        f.username === testUsers[1].username
      )).toBe(true);
      
      console.log("checking second user's friends list...");
      const friends2 = await axios.get(`http://localhost:${port}/${testUsers[1].username}/friends`, {
        headers: { Cookie: cookies2 },
        withCredentials: true
      });
      
      console.log("second user's friends:", friends2.data);
      expect(friends2.status).toBe(200);
      expect(friends2.data.results.some(f => 
        f.user_id === user1Id || 
        f.username === testUsers[0].username
      )).toBe(true);
      
      // remove the friendship
      console.log('Removing friend relationship...');
      console.log(`POST http://localhost:${port}/${testUsers[0].username}/removeFriend`);
      console.log('Request body:', { friendUsername: testUsers[1].username });
      console.log('Request headers:', { Cookie: cookies1 });
      
      const removeFriendResp = await axios.post(`http://localhost:${port}/${testUsers[0].username}/removeFriend`, {
        friendUsername: testUsers[1].username
      }, {
        headers: { Cookie: cookies1 },
        withCredentials: true
      });
      
      console.log('remove friend response:', removeFriendResp.data);
      expect(removeFriendResp.status).toBe(200);
      expect(removeFriendResp.data.message).toBe('Friend removed successfully.');
      
      // verify friendship was removed from database
      console.log('verifying friendship removal in database...');
      const friendshipsAfterRemoval = await send_sql(
        `SELECT * FROM friends 
         WHERE (follower = ? AND followed = ?) 
            OR (follower = ? AND followed = ?)`,
        [user1Id, user2Id, user2Id, user1Id]
      );
      
      console.log('Friendship records after removal:', friendshipsAfterRemoval[0]);
      // should find no records (friendship was bidirectionally removed)
      expect(friendshipsAfterRemoval[0].length).toBe(0);
      
      // verify through api that friends are removed for both users
      console.log("checking first user's friends list after removal...");
      const friends1AfterRemoval = await axios.get(`http://localhost:${port}/${testUsers[0].username}/friends`, {
        headers: { Cookie: cookies1 },
        withCredentials: true
      });
      
      console.log("first user's friends after removal:", friends1AfterRemoval.data);
      expect(friends1AfterRemoval.status).toBe(200);
      expect(friends1AfterRemoval.data.results.some(f => 
        f.user_id === user2Id || 
        f.username === testUsers[1].username
      )).toBe(false);
      
      console.log("checking second user's friends list after removal...");
      const friends2AfterRemoval = await axios.get(`http://localhost:${port}/${testUsers[1].username}/friends`, {
        headers: { Cookie: cookies2 },
        withCredentials: true
      });
      
      console.log("second user's friends after removal:", friends2AfterRemoval.data);
      expect(friends2AfterRemoval.status).toBe(200);
      expect(friends2AfterRemoval.data.results.some(f => 
        f.user_id === user1Id || 
        f.username === testUsers[0].username
      )).toBe(false);
      
    } catch (error) {
      console.log('Test error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
      throw error;
    }
  });
});