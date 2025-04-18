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

async function delete_tables() {

    // tables that did not exist in homework 4 will be deleted
    // or tables that have been changed since homework 4
    // deleted: 
    // - users
    // - posts
    // - comments
    // - post_weights
    // - likes
    // - chat_rooms
    // - chat_members
    // - chat_messages
    // - chat_invites
    // - online_users

    await dbaccess.send_sql('DROP TABLE IF EXISTS chat_members;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS chat_messages;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS chat_invites;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS online_users;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS chat_rooms;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS comments;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS likes;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS post_weights;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS posts;');
    await dbaccess.send_sql('DROP TABLE IF EXISTS users;');


    return null;
}

console.log('Deleting tables: users, posts, comments, post_weights, likes, chat_rooms, chat_members, chat_messages, chat_invites, online_users');

async function do_the_delete() {
    await dbaccess.connect();
    await delete_tables();
    console.log('Tables deleted');
}

do_the_delete().then(() => {
    console.log('Done');
    dbaccess.close();
}).catch((err) => {
    console.error(err);
    dbaccess.close();
}
).finally(() => {
    process.exit(0);
});

