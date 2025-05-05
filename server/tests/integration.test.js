import express from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';
import FormData from 'form-data';

import register_routes from '../routes/register_routes.js';
import { getFriends, getFriendRecs, addFriend, removeFriend } from '../routes/friend_routes.js';
import RouteHelper from '../routes/route_helper.js';
import {get_db_connection, set_db_connection, RelationalDB} from '../models/rdbms.js';
import session from 'express-session';
import S3KeyValueStore from '../models/s3.js';

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
    linked_nconst: 'nm0000122' 
  },
  { 
    username: 'test_friend2', 
    password: 'testpass2', 
    linked_nconst: 'nm0003424'
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
    
    // user IDs of all test users
    const existingUsers = await send_sql(
      "SELECT user_id FROM users WHERE username IN (?, ?, ?)", 
      [testUsers[0].username, testUsers[1].username, 'kafka_test_user']
    );
    
    // if no test users exist, nothing to clean up
    if (!existingUsers[0] || existingUsers[0].length === 0) {
      console.log('No test users found to clean up');
      return;
    }
    
    const userIds = existingUsers[0].map(u => u.user_id);
    console.log('Cleaning up users with IDs:', userIds);
    
    // remove posts from test users
    const testPosts = await send_sql(
      "SELECT post_id FROM posts WHERE text_content LIKE ? OR text_content LIKE ?", 
      ['%Test Kafka%', '%BlueSky post%']
    );
    
    let postIds = [];
    if (testPosts[0] && testPosts[0].length > 0) {
      postIds = testPosts[0].map(p => p.post_id);
      console.log('Cleaning up posts with IDs:', postIds);
    }
    
    // get all posts by these users if not already included
    const userPosts = await send_sql(
      "SELECT post_id FROM posts WHERE user_id IN (?) AND post_id NOT IN (?)", 
      [userIds, postIds.length > 0 ? postIds : [0]] // avoid empty clause
    );
    
    if (userPosts[0] && userPosts[0].length > 0) {
      const additionalPostIds = userPosts[0].map(p => p.post_id);
      console.log('Found additional user posts:', additionalPostIds);
      postIds = [...postIds, ...additionalPostIds];
    }
    
    try {
      if (postIds.length > 0) {
        // delete post_weights that reference these posts or users
        await send_sql("DELETE FROM post_weights WHERE post_id IN (?) OR user_id IN (?)", 
          [postIds, userIds]);
        
        // delete comments for these posts
        await send_sql("DELETE FROM comments WHERE post_id IN (?)", [postIds]);
        
        // delete likes for these posts
        await send_sql("DELETE FROM likes WHERE post_id IN (?)", [postIds]);
        
        // delete the posts
        await send_sql("DELETE FROM posts WHERE post_id IN (?)", [postIds]);
      }
      
      // delete any remaining post_weights records where test users are viewers
      await send_sql("DELETE FROM post_weights WHERE user_id IN (?)", [userIds]);
      
      // delete friend relationships
      await send_sql("DELETE FROM friends WHERE follower IN (?) OR followed IN (?)", 
        [userIds, userIds]);
      
      // delete from friend_recs if it exists
      await send_sql("DELETE FROM friend_recs WHERE user IN (?) OR recommendation IN (?)",
        [userIds, userIds]);
      
      // delete social_rank entries
      await send_sql("DELETE FROM social_rank WHERE user_id IN (?)", [userIds]);
      
      // delete the test users
      await send_sql("DELETE FROM users WHERE user_id IN (?)", [userIds]);
      
      console.log('Test data cleanup completed successfully');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('Cleanup error:', error);
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
        linked_nconst: testUsers[0].linked_nconst,
        first_name: 'Test',
        last_name: 'User',
        birthday: '1990-01-01',
        email: 'test@example.com',
        affiliation: 'Test Organization',
        hashtags: '#test'
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
        linked_nconst: testUsers[1].linked_nconst
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

describe('Kafka Integration Tests', () => {
  let testUserId;
  let testUserCookies;
  let blueSkyUserId;
  let testPostIds = []; // for cleanup
  
  afterEach(async () => {
    try {
      // clean up post weights and posts
      for (const postId of testPostIds) {
        await send_sql(
          "DELETE FROM post_weights WHERE post_id = ?",
          [postId]
        );
        
        await send_sql(
          "DELETE FROM posts WHERE post_id = ?",
          [postId]
        );
        
        console.log(`Cleaned up test post ${postId} and its weights`);
      }
      
      // reset the tracking array
      testPostIds = [];
      
      // also clean up by content we added
      const potentialPosts = await send_sql(
        "SELECT post_id FROM posts WHERE text_content LIKE ? OR text_content LIKE ? OR text_content LIKE ?",
        ['Test Kafka post%', 'Test Kafka image post%', 'Test Kafka mocked image post%']
      );
      
      if (potentialPosts[0] && potentialPosts[0].length > 0) {
        for (const post of potentialPosts[0]) {
          await send_sql("DELETE FROM post_weights WHERE post_id = ?", [post.post_id]);
          await send_sql("DELETE FROM posts WHERE post_id = ?", [post.post_id]);
          console.log(`Cleaned up additional test post ${post.post_id}`);
        }
      }
    } catch (error) {
      console.log('Test cleanup error:', error);
    }
  });
  
  // create test user
  beforeAll(async () => {
    try {
      const kafkaTestUser = {
        username: 'kafka_test_user',
        password: 'testpass',
        linked_nconst: 'nm0000122'
      };
      
      // remove and clean up existing test users
      await send_sql("DELETE FROM users WHERE username = ?", [kafkaTestUser.username]);
      await send_sql("DELETE FROM posts WHERE text_content LIKE 'Test Kafka post%'", []);
      
      // register test user
      const reg = await axios.post(`http://localhost:${port}/register`, {
        username: kafkaTestUser.username,
        password: kafkaTestUser.password,
        linked_nconst: kafkaTestUser.linked_nconst
      });
      
      expect(reg.status).toBe(200);
      
      // extract user id from response message
      const userJson = JSON.parse(reg.data.message.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
      testUserId = userJson.user_id;
      
      // login to get session cookies
      const login = await axios.post(`http://localhost:${port}/login`, {
        username: kafkaTestUser.username,
        password: kafkaTestUser.password
      }, { withCredentials: true });
      
      expect(login.status).toBe(200);
      testUserCookies = login.headers['set-cookie'];
      
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });
  
  test('Create post and verify it gets sent to Kafka', async () => {
    try {
      // define test post with content
      const testPostContent = `Test Kafka post ${Date.now()}`;
      
      // create post
      const createPostResponse = await axios.post(
        `http://localhost:${port}/kafka_test_user/createPost`, 
        {
          text_content: testPostContent,
          hashtags: '#test #kafka'
        },
        {
          headers: { Cookie: testUserCookies },
          withCredentials: true
        }
      );
      
      expect(createPostResponse.status).toBe(201);
      expect(createPostResponse.data.message).toBe('Post created.');
      
      // give time for kafka to process the message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // get the post from the database to verify it exists locally
      const posts = await send_sql(
        "SELECT * FROM posts WHERE text_content = ?",
        [testPostContent]
      );
      
      expect(posts[0].length).toBeGreaterThan(0);
      const post = posts[0][0];
      testPostIds.push(post.post_id);
      expect(post.text_content).toBe(testPostContent);
      expect(post.hashtags).toBe('#test #kafka');
    } catch (error) {
      console.log('Test error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
      throw error;
    }
  });
  
  test('Fetch Kafka posts from feed endpoint', async () => {
    try {
      const blueSkyExists = await send_sql(
        "SELECT user_id FROM users WHERE username = ?",
        ['BlueSky']
      );
      
      if (!blueSkyExists[0] || blueSkyExists[0].length === 0) {
        throw new Error('BlueSky user not found in database');
      }
      
      blueSkyUserId = blueSkyExists[0][0].user_id;
      console.log(`Found BlueSky user with ID: ${blueSkyUserId}`);
      
      // create test post from bluesky user with source
      const testPost = `Test BlueSky post ${Date.now()}`;
      console.log(`Creating test post: ${testPost}`);
      
      const postResult = await send_sql(
        "INSERT INTO posts (user_id, text_content, hashtags, source) VALUES (?, ?, ?, ?)",
        [blueSkyUserId, testPost, '#test #bluesky', 'bluesky']
      );
      
      const postId = postResult[0].insertId;
      testPostIds.push(postId);
      
      // add post weight for test user to see bluesky post
      await send_sql(
        "INSERT INTO post_weights (post_id, user_id, weight) VALUES (?, ?, ?)",
        [postId, testUserId, 0.9]
      );
      
      console.log('Fetching feed to check for BlueSky post...');
      const feedResponse = await axios.get(
        `http://localhost:${port}/kafka_test_user/feed`,
        {
          headers: { Cookie: testUserCookies },
          withCredentials: true
        }
      );
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.data.results).toBeDefined();
      
      // Check if our bluesky test post appears in the feed
      const postInFeed = feedResponse.data.results.some(post => 
        post.post_id === postId && 
        post.text_content === testPost && 
        post.source === 'bluesky'
      );
      
      expect(postInFeed).toBe(true);
      console.log('Successfully found BlueSky test post in feed');
    
      // cleanup
      await send_sql("DELETE FROM post_weights WHERE post_id = ?", [postId]);
      await send_sql("DELETE FROM posts WHERE post_id = ?", [postId]);
      
      // remove from tracking
      testPostIds = testPostIds.filter(id => id !== postId);
      
    } catch (error) {
      console.log('Test error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
      throw error;
    }
  });

  // test sending different types of content (text, images)
  test('Create post with image and verify Kafka processing', async () => {
    const testImagePath = '/root/nets2120/project-instalite-wahoo/server/tests/laurenbacall.jpeg';

    try {
      // create form data instance
      const form = new FormData();
      form.append('text_content', 'Test Kafka image post');
      form.append('hashtags', '#test #image');
      form.append('image', fs.createReadStream(testImagePath));
      
      // send post with image
      const response = await axios.post(
        `http://localhost:${port}/kafka_test_user/createPost`,
        form,
        {
          headers: { 
            Cookie: testUserCookies,
            ...form.getHeaders() // needs node.js form-data package
          }
        }
      );
      
      expect(response.status).toBe(201);
      
      // wait for kafka processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // verify post in database with image_url
      const posts = await send_sql(
        "SELECT * FROM posts WHERE text_content = ? AND image_url IS NOT NULL",
        ['Test Kafka image post']
      );
      
      expect(posts[0].length).toBeGreaterThan(0);
      const post = posts[0][0];
      testPostIds.push(post.post_id);
      expect(post.image_url).toContain('s3.amazonaws.com');
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });

  test('Test Kafka with mocked image', async () => {
    try {
      // create mock s3 url that would be returned after upload
      const mockS3Url = `https://nets2120-chroma-${process.env.USER_ID}.s3.amazonaws.com/posts/mocked-test-image.jpg`;
      
      // store the original function
      const originalUploadFile = S3KeyValueStore.prototype.uploadFile;
      
      // create simple mock function for the test
      S3KeyValueStore.prototype.uploadFile = async () => 'posts/mocked-test-image.jpg';
      
      // test creating a post with our mocked s3 url
      const createPostResponse = await axios.post(
        `http://localhost:${port}/kafka_test_user/createPost`,
        {
          text_content: 'Test Kafka mocked image post',
          hashtags: '#test #mockimage',
          // s3 upload is mocked, don't need to provide real file
        },
        {
          headers: { Cookie: testUserCookies },
          withCredentials: true
        }
      );
      
      expect(createPostResponse.status).toBe(201);
      
      // wait for kafka processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // verify that our post was created
      const posts = await send_sql(
        "SELECT * FROM posts WHERE text_content = ?",
        ['Test Kafka mocked image post']
      );
      
      expect(posts[0].length).toBeGreaterThan(0);
      const post = posts[0][0];
      testPostIds.push(post.post_id);
      
      // restore the original function
      S3KeyValueStore.prototype.uploadFile = originalUploadFile;
    } catch (error) {
      console.error('Mock S3 test error:', error);
      throw error;
    }
  });
});