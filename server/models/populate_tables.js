import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';
 

// Populates the tables with demo data
// npm run populate_tables              |  clears the tables before adding demo data
// npm run populate_tables --append     |  appends demo data to the tables

console.log('Append? : ' + (process.env.npm_config_append !== undefined));
const dbaccess = get_db_connection();
const helper = new RouteHelper();

function crypt(query) {
    return new Promise((resolve, reject) => {
      helper.encryptPassword('test', function(err, hash) {
        if (err)
          reject(err);
        else
          resolve(hash);
      });
  });
}

async function populate_tables() {
    if (!process.env.npm_config_append) {
        console.log('Tables will be cleared before populating');
        console.log('Auto-increments will be reset to 1');
        // await dbaccess.send_sql('DELETE FROM chat_members;');
        // await dbaccess.send_sql('DELETE FROM chat_messages;');
        // await dbaccess.send_sql('DELETE FROM chat_invites;');
        // await dbaccess.send_sql('DELETE FROM online_users;');
        // await dbaccess.send_sql('DELETE FROM chat_rooms;');
        await dbaccess.send_sql('DELETE FROM comments;');
        await dbaccess.send_sql("ALTER TABLE comments AUTO_INCREMENT = 1");
        await dbaccess.send_sql('DELETE FROM likes;');
        await dbaccess.send_sql("ALTER TABLE likes AUTO_INCREMENT = 1");
        await dbaccess.send_sql('DELETE FROM post_weights;');
        await dbaccess.send_sql('DELETE FROM posts;');
        await dbaccess.send_sql("ALTER TABLE posts AUTO_INCREMENT = 1");
        await dbaccess.send_sql('DELETE FROM users;');
        await dbaccess.send_sql("ALTER TABLE users AUTO_INCREMENT = 1");
    }

    console.log('Populating tables with demo data');

    // POPULATING USERS
    // (all passwords are 'test')
    var hash = await crypt('test');
    console.log("HASH: " + hash);

    const addUser = async (username, hashtags, linked_nconst) => {
        const result = await dbaccess.send_sql(`
            INSERT IGNORE INTO users (username, hashed_password, hashtags, linked_nconst) 
            VALUES (?, ?, ?, ?)`, 
            [username, hash, hashtags, linked_nconst]
        );
        return result[0].insertId;
    }

    const cd_id = await addUser('charlesdickens', 'author,novel', 'nm0002042');
    const ws_id = await addUser('williamshakespeare', 'author,novel', 'nm0000636');
    const al_id = await addUser('abrahamlincoln', 'politician,lawyer', 'nm1118823');
    const cb_id = await addUser('charlottebronte', 'author,novel', 'nm0111576');
    const eap_id = await addUser('edgarallanpoe', 'author,spooky', 'nm0000590');
    const mt_id = await addUser('marktwain', 'author,novel', 'nm0878494');
    const hbs_id = await addUser('harrietbeecherstowe', 'author,novel', 'nm0832952');
    const acd_id = await addUser('arthurconandoyle', 'author,novel', 'nm0236279');
    const ms_id = await addUser('maryshelley', 'author,spooky', 'nm0791217');

    // POPULATING POSTS
    const addPost = async (user_id, image_url, text_content, hashtags) => {
        const result = await dbaccess.send_sql(`
            INSERT IGNORE INTO posts (user_id, image_url, text_content, hashtags, source) 
            VALUES (?, ?, ?, ?, 'local')`, 
            [user_id, image_url, text_content, hashtags]
        );
        return result[0].insertId;
    }

    const post1_id = await addPost(cd_id, 'https://i.imgur.com/1.jpg', 'A Tale of Two Cities', 'novel,book');
    const post2_id = await addPost(cd_id, 'https://i.imgur.com/2.jpg', 'Great Expectations', 'novel,book');
    const post3_id = await addPost(ws_id, 'https://i.imgur.com/3.jpg', 'Romeo and Juliet', 'novel,book');
    const post4_id = await addPost(ws_id, 'https://i.imgur.com/4.jpg', 'Hamlet', 'novel,book');
    const post5_id = await addPost(al_id, 'https://i.imgur.com/5.jpg', 'The Gettysburg Address', 'speech,politics');
    const post6_id = await addPost(cb_id, 'https://i.imgur.com/6.jpg', 'Jane Eyre', 'novel,book');
    const post7_id = await addPost(eap_id, 'https://i.imgur.com/7.jpg', 'The Raven', 'poem,spooky');
    const post8_id = await addPost(mt_id, 'https://i.imgur.com/8.jpg', 'The Adventures of Tom Sawyer', 'novel,book');
    const post9_id = await addPost(hbs_id, 'https://i.imgur.com/9.jpg', 'Uncle Tom\'s Cabin', 'novel,book');
    const post10_id = await addPost(acd_id, 'https://i.imgur.com/10.jpg', 'Sherlock Holmes', 'novel,book');
    const post11_id = await addPost(ms_id, 'https://i.imgur.com/11.jpg', 'Frankenstein', 'novel,spooky');
    const post12_id = await addPost(cd_id, 'https://i.imgur.com/12.jpg', 'David Copperfield', 'novel,book');

    // POPULATING COMMENTS
    const addComment = async (post_id, user_id, text_content) => {
        const result = await dbaccess.send_sql(`
            INSERT IGNORE INTO comments (post_id, user_id, text_content) 
            VALUES (?, ?, ?)`, 
            [post_id, user_id, text_content]
        );
        return result[0].insertId;
    }

    const comment1_id = await addComment(post1_id, ws_id, 'A tale of two cities is a great book!');
    const comment2_id = await addComment(post1_id, al_id, 'I love this book!');
    const comment3_id = await addComment(post2_id, cb_id, 'Great Expectations is a classic!');
    const comment4_id = await addComment(post3_id, eap_id, 'Romeo and Juliet is a tragedy!');
    const comment5_id = await addComment(post4_id, mt_id, 'Hamlet is a masterpiece!');
    const comment6_id = await addComment(post5_id, hbs_id, 'The Gettysburg Address is a powerful speech!');
    const comment7_id = await addComment(post6_id, acd_id, 'Jane Eyre is a great novel!');
    const comment8_id = await addComment(post7_id, ms_id, 'The Raven is so spooky!');
    const comment9_id = await addComment(post8_id, cd_id, 'The Adventures of Tom Sawyer is a fun read!');
    const comment10_id = await addComment(post9_id, ws_id, 'Uncle Tom\'s Cabin is a must-read!');
    const comment11_id = await addComment(post10_id, al_id, 'Sherlock Holmes is a great detective!');
    const comment12_id = await addComment(post11_id, cb_id, 'Frankenstein is a classic horror story!');

    // POPULATING LIKES
    const addLike = async (post_id, user_id) => {
        const result = await dbaccess.send_sql(`
            INSERT IGNORE INTO likes (post_id, user_id) 
            VALUES (?, ?)`, 
            [post_id, user_id]
        );
    }

    await addLike(post1_id, ws_id);
    await addLike(post1_id, al_id);
    await addLike(post2_id, cb_id);
    await addLike(post3_id, eap_id);
    await addLike(post4_id, mt_id);
    await addLike(post5_id, hbs_id);
    await addLike(post6_id, acd_id);
}


async function do_the_populate() {
    console.log('Populating!');
    await dbaccess.connect();
    await populate_tables();
    console.log('Tables populated');
}

do_the_populate().then(() => {
    console.log('Done');
    dbaccess.close();
}).catch((err) => {
    console.error(err);
    dbaccess.close();
}
).finally(() => {
    process.exit(0);
});

