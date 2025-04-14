import { get_db_connection, RelationalDB } from '../models/rdbms.js';

// Database connection setup
const dbaccess = get_db_connection();

function sendQueryOrCommand(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

async function create_tables() {

  /**
   * These should exist from HW2 and 3
   */

  // Note here that birth/death year should really be int but have often been put as string
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS names ( \
    nconst VARCHAR(255) UNIQUE, \
    primaryName VARCHAR(255), \
    birthYear VARCHAR(4), \
    deathYear VARCHAR(4), \
    nconst VARCHAR(255) PRIMARY KEY \
    );')

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS recommendations ( \
      person VARCHAR(255), \
      recommendation VARCHAR(255), \
      strength int, \
      FOREIGN KEY (person) REFERENCES names(nconst), \
      FOREIGN KEY (recommendation) REFERENCES names(nconst) \
      );')
  
    /**
     * This should also exist from HW3
     */
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS friends ( \
    followed VARCHAR(255), \
    follower VARCHAR(255), \
    FOREIGN KEY (follower) REFERENCES names(nconst), \
    FOREIGN KEY (followed) REFERENCES names(nconst) \
    );')

    ///////////
    // TODO: create users and posts tables

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS users ( \
      user_id int NOT NULL AUTO_INCREMENT PRIMARY KEY, \
      username VARCHAR(255), \
      hashed_password VARCHAR(255), \
      linked_nconst VARCHAR(255), \
      FOREIGN KEY (linked_nconst) REFERENCES names(nconst) \
      );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS posts ( \
      post_id int NOT NULL AUTO_INCREMENT PRIMARY KEY, \
      parent_post int, \
      title VARCHAR(255), \
      content VARCHAR(255), \
      author_id int, \
      FOREIGN KEY (parent_post) REFERENCES posts(post_id), \
      FOREIGN KEY (author_id) REFERENCES users(user_id) \
      );')

    // Create tables for chat mode
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS chat_rooms ( \
      room_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
      room_name VARCHAR(255), \
      is_group_chat BOOLEAN DEFAULT FALSE, \
      );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS chat_members ( \
      room_id INT NOT NULL, \
      user_id INT NOT NULL, \
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
      PRIMARY KEY (room_id, user_id), \
      FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id), \
      FOREIGN KEY (user_id) REFERENCES users(user_id) \
      );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS chat_messages ( \
      message_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
      room_id INT NOT NULL, \
      sender_id INT NOT NULL, \
      content TEXT NOT NULL, \
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
      FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id), \
      FOREIGN KEY (sender_id) REFERENCES users(user_id) \
      );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS chat_invites ( \
      invite_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
      sender_id INT NOT NULL, \
      receiver_id INT NOT NULL, \
      status ENUM("pending", "accepted") DEFAULT "pending", \
      FOREIGN KEY (sender_id) REFERENCES users(user_id), \
      FOREIGN KEY (receiver_id) REFERENCES users(user_id) \
      );')

    return null;
}

console.log('Creating tables');

async function create_populate() {
  await dbaccess.connect();
  await create_tables();
  console.log('Tables created');
}

create_populate().then(() => {
  console.log('Done');
  dbaccess.close();
}).catch((err) => {
  console.error(err);
  dbaccess.close();
}
).finally(() => {
  process.exit(0);
});

