CREATE TABLE IF NOT EXISTS names (
    nconst VARCHAR(255) PRIMARY KEY UNIQUE,
    primaryName VARCHAR(255),
    birthYear VARCHAR(4),
    deathYear VARCHAR(4)
);

-- Creating the users table
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    hashtags VARCHAR(255),
    linked_nconst VARCHAR(255),
    FOREIGN KEY (linked_nconst) REFERENCES names(nconst)
);

-- Creating the posts table
CREATE TABLE posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    image_url VARCHAR(255),
    text_content TEXT NOT NULL,
    hashtags VARCHAR(255),
    timestamp TIMESTAMP NOT NULL,
    source ENUM('local', 'bluesky', 'federated') NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the social_rank table
CREATE TABLE social_rank (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    social_rank INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the post_weights table
CREATE TABLE post_weights (
    post_id INT,
    user_id INT,
    weight INT NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the comments table
CREATE TABLE comments (
    comment_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT,
    parent_id INT,
    user_id INT,
    text TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (parent_id) REFERENCES comments(comment_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the likes table
CREATE TABLE likes (
    like_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT,
    user_id INT,
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the friends table
CREATE TABLE friends (
    followed INT,
    follower INT,
    PRIMARY KEY (followed, follower),
    FOREIGN KEY (followed) REFERENCES users(user_id),
    FOREIGN KEY (follower) REFERENCES users(user_id)
);

-- Creating the friend_recs table
CREATE TABLE friend_recs (
    user1_id INT,
    user2_id INT,
    PRIMARY KEY (user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(user_id),
    FOREIGN KEY (user2_id) REFERENCES users(user_id)
);

-- Creating the chats table
CREATE TABLE chats (
    chat_id INT PRIMARY KEY AUTO_INCREMENT,
    is_group_chat BOOLEAN NOT NULL
);

-- Creating the chat_members table
CREATE TABLE chat_members (
    chat_id INT,
    user_id INT,
    status VARCHAR(255),
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Creating the chat_messages table
CREATE TABLE chat_messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id INT,
    sender_id INT,
    content TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id),
    FOREIGN KEY (sender_id) REFERENCES users(user_id)
);

-- Creating the chat_invites table
CREATE TABLE chat_invites (
    invite_id INT PRIMARY KEY AUTO_INCREMENT,
    from_user_id INT,
    to_user_id INT,
    chat_id INT,
    status VARCHAR(255),
    FOREIGN KEY (from_user_id) REFERENCES users(user_id),
    FOREIGN KEY (to_user_id) REFERENCES users(user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);
