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
        await dbaccess.send_sql(`
            INSERT IGNORE INTO users (username, hashed_password, hashtags, linked_nconst) 
            VALUES (?, ?, ?, ?)`, 
            [username, hash, hashtags, linked_nconst]
        );
    }

    await addUser('charlesdickens', 'author,novelist', 'nm0002042');
    await addUser('williamshakespeare', 'author,novelist', 'nm0000636');
    await addUser('abrahamlincoln', 'politician,lawyer', 'nm1118823');
    await addUser('charlottebronte', 'author,novelist', 'nm0111576');
    await addUser('edgarallanpoe', 'author,spooky', 'nm0000590');
    await addUser('marktwain', 'author,novelist', 'nm0878494');
    await addUser('harrietbeecherstowe', 'author,novelist', 'nm0832952');
    await addUser('arthurconandoyle', 'author,novelist', 'nm0236279');
    await addUser('maryshelley', 'author,spooky', 'nm0791217');

    // POPULATING POSTS

    // POPULATING COMMENTS

    // POPULATING LIKES
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

