import express from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';

import register_routes from '../routes/register_routes.js';
import RouteHelper from '../routes/route_helper.js';
import {get_db_connection, set_db_connection, RelationalDB} from '../models/rdbms.js';
import session from 'express-session';

const configFile = fs.readFileSync('config.json', 'utf8');
import dotenv from 'dotenv';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

dotenv.config();
const config = JSON.parse(configFile);

const port = parseInt(config.serverPort)+1;
var helper = new RouteHelper();
var db = new RelationalDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({secret: 'nets2120_insecure', saveUninitialized: true, resave: true}));


register_routes(app);

function getAllMethods(obj) {
    return Object.keys(obj)
        .filter((key) => typeof obj[key] === 'function')
        .map((key) => obj[key]);
}

var server = null;

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

async function clear_mock_db() {    
    try {
        var sample_db = await db.connect();

        // testing using old people because there're probably not any photos of them
        // nm0515385 for livy
        // nm0019604 for dante
        // nm0282040 for johnfletcher


        // CLEAR FRIENDS
        await sample_db.send_sql(`
            DELETE FROM friends 
            WHERE follower='nm0515385' 
            OR follower='nm0019604'
            OR follower='nm0282040'
            OR followed='nm0515385'
            OR followed='nm0019604'
            OR followed='nm0282040'
        `);

        // CLEAR LIKES
        await sample_db.send_sql(`
            DELETE FROM likes
            WHERE post_id IN (
                SELECT post_id FROM posts
                WHERE hashtags LIKE '%lemontest%'
            )
        `);

        // CLEAR COMMENTS
        await sample_db.send_sql(`
            DELETE FROM comments
            WHERE post_id IN (
                SELECT post_id FROM posts
                WHERE hashtags LIKE '%lemontest%'
            )
        `);

        // CLEAR POSTS
        // all testing posts use the hashtag #lemontest
        await sample_db.send_sql(`
            DELETE FROM posts
            WHERE hashtags LIKE '%lemontest%'
        `);


        // CLEAR USERS
        await sample_db.send_sql(`
            DELETE FROM users
            WHERE username='livy'
            OR username='dante'
            OR username='johnfletcher'
        `);
    } catch (error) {
        console.log(error);
    }

}

async function populate_mock_db() {
    try {
        await clear_mock_db();
        var sample_db = await db.connect();
        var hash = await crypt('test');
        console.log("HASH: " + hash);
        
        // testing using old people because there're probably not any photos of them
        // nm0515385 for livy
        // nm0019604 for dante
        // nm0282040 for johnfletcher

        await sample_db.send_sql(`
            INSERT IGNORE INTO users (username, hashed_password, linked_nconst) 
            VALUES (?, ?, ?)
        `, ['livy', hash, 'nm0515385']);

        await sample_db.send_sql(`
            INSERT IGNORE INTO users (username, hashed_password, linked_nconst)
            VALUES (?, ?, ?)
        `, ['dante', hash, 'nm0019604']);

        await sample_db.send_sql(`
            INSERT IGNORE INTO users (username, hashed_password, linked_nconst)
            VALUES (?, ?, ?)
        `, ['johnfletcher', hash, 'nm0282040']);

        // they're all friends :)
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0515385', 'nm0019604']);
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0019604', 'nm0515385']);
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0515385', 'nm0282040']);
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0282040', 'nm0515385']);
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0019604', 'nm0282040']);
        await sample_db.send_sql('INSERT IGNORE INTO friends (follower, followed) VALUES (?, ?)', ['nm0282040', 'nm0019604']);

    } catch (error) {
        console.log(error);
    }
};

/**
* Initialization - set up mock database connection
*/
beforeAll(async () => {
    await populate_mock_db();

    var raw_db = get_db_connection();
    var mock_db = {
    send_sql: (sql, params = [], callback) => {
        raw_db.send_sql(sql, params).then((result) => {
            callback(null, result);
        }).catch ((error) => {
            console.log("SQL error" + error);
            callback(error, null);
        });
    },
    insert_items: (sql, params = [], callback) => {
        raw_db.insert_items(sql, params).then((result) => {
            callback(null, result);
        }).catch ((error) => {
            console.log("SQL error" + error);
            callback(error, null);
        });
    },
    create_tables: (sql, params = [], callback) => {
        raw_db.create_tables(sql, params).then((result) => {
            callback(null, result);
        }).catch ((error) => {
            console.log("SQL error" + error);
            callback(error, null);
        });
    },
    connect: async () => {
        return await raw_db.connect();
    },
    close: () => {
        return raw_db.close();
    }
    }
    set_db_connection(mock_db);

    server = app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })
}, 20000);


test('Hello world', async () => {
    try {
        var response = await axios.get('http://localhost:' + port + '/hello')
        const ret = JSON.stringify(response.data.message);
        response = null;    // Need to do this to avoid jest circular ref
        expect (ret === 'Hello, world!');
        console.log('Passed test_hello')
    } catch (error) {
        console.log(error.response.status);
        expect(true).toBe(false);
    }
});

// TITUS IS LOGGED IN
describe('Testing createPost', () => {
    const cookieJar = new CookieJar();
    const axiosPersist = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));

    test('postLogin: for posting', async () => {
        try {
            var response = await axiosPersist.post('http://localhost:' + port + '/login', {username: 'livy', password: 'test'});
            const status = response.status;
            response = null;
            expect(status).toBe(200);
        } catch {
            expect(true).toBe(false);
        }
    });

    test('createPost: not logged in', async () => {
        try {
            await axiosPersist.post('http://localhost:' + port + '/dante/createPost');
            expect(true).toBe(false);
        } catch (error) {
            console.log(error.response.data);
            expect(error.response.status).toBe(403);
        }
    });

    test('createPost: missing field', async () => {
        try {
            await axiosPersist.post('http://localhost:' + port + '/livy/createPost', {image_url: 'test', hashtags: 'lemontest'});
            expect(true).toBe(false);
        } catch (error) {
            console.log(error.response.data);
            expect(error.response.status).toBe(400);
        }
    });

    test('createPost: bad entry', async () => {
        try {
            await axiosPersist.post('http://localhost:' + port + '/livy/createPost', {text_content: 'maliciousss"', hashtags: 'lemontest'});
            expect(true).toBe(false);
        } catch (error) {
            console.log(error.response.data);
            expect(error.response.status).toBe(400);
        }
    });

    test('createPost: (successful)', async () => {
        try {
            var response = await axiosPersist.post('http://localhost:' + port + '/livy/createPost', 
            {text_content: 'From The Founding of The City wahoo test case', hashtags: 'lemontest'});
            const status = response.status;
            response = null;
            expect(status).toBe(201);
        } catch (error) {
            console.log(error.response.data);
            expect(true).toBe(false);
        }
    });
});

// describe('Testing getFeed', () => {
//     const cookieJar = new CookieJar();
//     const axiosPersist = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));

//     // charlesdickens is logged in for this test suite :)
//     test('postLogin', async () => {
//     try {
//         var response = await axiosPersist.post('http://localhost:' + port + '/login', {username: 'charlesdickens', password: 'greatexpectations'});
//         const status = response.status;
//         response = null;
//         expect(status).toBe(200);
//     } catch {
//         expect(true).toBe(false);
//     }
//     });

//     // posts are populated in the beforeAll and createPost test cases

//     test('getFeed: not logged in', async () => {
//     try {
//         await axiosPersist.get('http://localhost:' + port + '/user2/feed');
//         expect(true).toBe(false);
//     } catch (error) {
//         console.log(error.response.data);
//         expect(error.status).toBe(403);
//     }
//     });

//     test('getFeed: (successful)', async () => {
//     try {
//         var response = await axiosPersist.get('http://localhost:' + port + '/charlesdickens/feed');
//         console.log('got feed successfully');
//         const ret = response.data.results;
//         console.log(ret);
//         const status = response.status;
//         response = null;    // Need to do this to avoid jest circular ref
//         expect(status).toBe(200);
//         expect(ret.length).toBe(3);
//         expect(ret.filter((post) => (post.username === "test") && (post.title === "Post 1")).length).toBe(1);
//         expect(ret.filter((post) => (post.username === "user2") && (post.title === "Post 2")).length).toBe(1);
//         expect(ret.filter((post) => (post.username === "charlesdickens") && (post.title === "upcoming book drop")).length).toBe(1);
//         console.log('Yayy charlesdickens has the proper feed');
//     } catch (error) {
//         console.log(error.status);
//         console.log(error.response.data);
//         expect(true).toBe(false);
//     }
//     });
// });

/**
 * Shutdown the server
 */
afterAll(async () => { 
    await clear_mock_db();
    db.close();
    await server.close();
    await new Promise(resolve => setTimeout(() => resolve(), 50)); // avoid jest open handle error
    console.log('Tests are completed. Closing server.');
});
