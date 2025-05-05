import { get_db_connection } from '../models/rdbms.js';

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

    // NAMES
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS names (
            nconst VARCHAR(255) UNIQUE,
            primaryName VARCHAR(255),
            birthYear VARCHAR(4),
            deathYear VARCHAR(4),
            nconst VARCHAR(255) PRIMARY KEY
        );
    `);

    // USERS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS users (
            user_id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255),
            hashed_password VARCHAR(255),
            hashtags VARCHAR(255),
            linked_nconst VARCHAR(255),
            profile_photo VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            birthday DATE,
            email VARCHAR(255),
            affiliation VARCHAR(255),
            FOREIGN KEY (linked_nconst) REFERENCES names(nconst)
        );
    `);

    // POSTS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS posts (
            post_id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id int NOT NULL,
            image_url VARCHAR(255),
            text_content TEXT NOT NULL,
            hashtags VARCHAR(255),
            source VARCHAR(255) DEFAULT 'local',
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

    // COMMENTS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS comments (
            comment_id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
            post_id int NOT NULL,
            parent_id int NOT NULL,
            user_id int NOT NULL,
            text_content TEXT,
            FOREIGN KEY (post_id) REFERENCES posts(post_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

    // SOCIAL_RANK
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS social_rank (
            user_id int NOT NULL PRIMARY KEY,
            social_rank double,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

    // POST_WEIGHTS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS post_weights (
            post_id int NOT NULL,
            user_id int NOT NULL,
            weight double,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(post_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        ); 
    `);

    // LIKES
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS likes (
            like_id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
            post_id int NOT NULL,
            user_id int NOT NULL,
            FOREIGN KEY (post_id) REFERENCES posts(post_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

    // FRIENDS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS friends (
            followed INT,
            follower INT,
            FOREIGN KEY (follower) REFERENCES users(user_id),
            FOREIGN KEY (followed) REFERENCES users(user_id)
        );
    `);

    // RECOMMENDATIONS (for friends)
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS friend_recs (
            user INT,
            recommendation INT,
            strength int,
            FOREIGN KEY (user) REFERENCES users(user_id),
            FOREIGN KEY (recommendation) REFERENCES users(user_id)
        );
    `);

    // RECOMMENDATIONS (for friends)
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS recommendations (
            person VARCHAR(255),
            recommendation VARCHAR(255),
            strength int,
            FOREIGN KEY (person) REFERENCES names(nconst),
            FOREIGN KEY (recommendation) REFERENCES names(nconst)
        );
    `);

    // CHAT ROOMS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS chat_rooms (
            room_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            room_name VARCHAR(255),
            is_group_chat BOOLEAN DEFAULT FALSE
        );
    `);

    // CHAT MEMBERS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS chat_members (
            room_id INT NOT NULL,
            user_id INT NOT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (room_id, user_id),
            FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

    // CHAT MESSAGES
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            message_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            room_id INT NOT NULL,
            sender_id INT NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id),
            FOREIGN KEY (sender_id) REFERENCES users(user_id)
        );
    `);

    // CHAT INVITES
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS chat_invites (
            sender_id INT NOT NULL,
            receiver_id INT NOT NULL,
            room_id INT,
            PRIMARY KEY (sender_id, receiver_id),
            FOREIGN KEY (sender_id) REFERENCES users(user_id),
            FOREIGN KEY (receiver_id) REFERENCES users(user_id),
            FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id)
        );
    `);

    // ONLINE USERS
    await dbaccess.create_tables(`
        CREATE TABLE IF NOT EXISTS online_users (
            user_id INT NOT NULL PRIMARY KEY,
            socket_id VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
    `);

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

