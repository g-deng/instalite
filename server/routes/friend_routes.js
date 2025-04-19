import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';

// Database connection setup
const db = get_db_connection();

var helper = new RouteHelper();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

// GET /friends
async function getFriends(req, res) {    
    console.log('Getting friends for ' + req.session.user_id);
    // TODO from friends table
    try {
        if(!helper.isLoggedIn(req, req.session.user_id)) {
            res.status(403).send({error: 'Not logged in.'});
        } else {
            /*
            const query = `
            
            SELECT n2.nconst, n2.primaryName FROM followers 
            JOIN names AS n1 ON n1.nconst = followers.follower
            JOIN names AS n2 ON n2.nconst = followers.followed
            JOIN users ON users.linked_nconst = n1.nconst
            WHERE users.user_id = ?
            `;
            const params = [req.session.user_id];
            const result = await queryDatabase(query, params);
            const fixed_result = result[0].map(row => ({
                followed: row.nconst,
                primaryName: row.primaryName
            }));
            res.status(200).send({results: fixed_result}); */

            const query = `
            SELECT u.user_id, u.username 
            FROM friends AS f
            JOIN users AS u ON f.followed = u.user_id
            WHERE f.follower = ?
            `;
            const params = [req.session.user_id];
            const result = await queryDatabase(query, params);
            console.log(result);
            res.status(200).send({ results: result[0]});
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({error: 'Error querying database'});
    }
}

// GET /recommendations
async function getFriendRecs(req, res) {
    // TODO from recommendations table
    console.log('Getting friend recs for ' + req.session.user_id);
    try {
        if(!helper.isLoggedIn(req, req.session.user_id)) {
            res.status(403).send({error: 'Not logged in.'});
        } else {
            /*
            const query = `
            SELECT n1.nconst, n1.primaryName FROM recommendations
            JOIN names AS n1 ON recommendations.recommendation = n1.nconst
            JOIN names AS n2 ON recommendations.person = n2.nconst
            JOIN users ON users.linked_nconst = n2.nconst
            WHERE users.user_id = ?
            `;
            const params = [req.session.user_id];
            const result = await queryDatabase(query, params);
            const fixed_result = result[0].map(row => ({
                followed: row.nconst,
                primaryName: row.primaryName
            }));
            res.status(200).send({results: fixed_result});
            */
           const query = `
           SELECT u.user_id, u.username 
           FROM friend_recs as f
           JOIN users AS u ON f.recommendation = u.user_id
           WHERE f.user = ?
           `;

           const params = [req.session.user_id];
           const result = await queryDatabase(query, params);
           console.log(result);
           res.status(200).send({ results: result[0]});
        }
    } catch (error) {
        res.status(500).send({error: 'Error querying database'});
    }
}

async function addFriend(req, res) {
    console.log('Adding friend for user: ' + req.session.user_id);
    try {
        if (!helper.isLoggedIn(req, req.session.user_id)) {
            res.status(403).send({ error: 'Not logged in.' });
            return;
        }

        const { friendUsername } = req.body;
        if (!friendUsername) {
            return res.status(400).send({ error: 'friendUsername parameter is required.' });
        }

        // extract the friendId from the inputted username
        const userQuery = `
            SELECT user_id
            FROM users
            WHERE username = ?
            LIMIT 1
        `;
        const userParams = [ friendUsername ];
        const userResult = await queryDatabase(userQuery, userParams);
        if (!userResult[0] || userResult[0].length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }
        const friendId = userResult[0][0].user_id;

        if (!friendId) {
            res.status(400).send({ error: 'friendId parameter is required.' });
            return;
        }
        if (friendId === req.session.user_id) {
            res.status(400).send({ error: 'You cannot add yourself as a friend.' });
            return;
        }

        // make sure potential friend exists
        let existQuery = `
            SELECT * FROM users
            WHERE user_id = ?
        `;
        let existParams = [friendId];
        const existres = await queryDatabase(existQuery, existParams);
        if (!existres[0] || existres[0].length == 0) {
            res.status(400).send({ error: 'Could not find user.' });
            return;
        }
        // check if friend already exists
        let checkQuery = `
            SELECT * FROM friends 
            WHERE follower = ? AND followed = ?
        `;
        let checkParams = [req.session.user_id, friendId];
        const existing = await queryDatabase(checkQuery, checkParams);
        if (existing[0] && existing[0].length > 0) {
            res.status(400).send({ error: 'Friend relationship already exists.' });
            return;
        }

        // insert into table
        const insertQuery = `
            INSERT INTO friends (follower, followed) 
            VALUES (?, ?)
        `;
        let insertParams = [req.session.user_id, friendId];
        await queryDatabase(insertQuery, insertParams);
        
        // insert bidirectionally 
        insertParams = [friendId, req.session.user_id];
        await queryDatabase(insertQuery, insertParams);
        res.status(200).send({ message: 'Friend added successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Error adding friend to the database.' });
    }
}

// DELETE /friends - Remove friend via username
async function removeFriend(req, res) {
    console.log('Removing friend for user: ' + req.session.user_id);
    try {
        if (!helper.isLoggedIn(req, req.session.user_id)) {
            return res.status(403).send({ error: 'Not logged in.' });
        }

        const { friendUsername } = req.body;
        if (!friendUsername) {
            return res.status(400).send({ error: 'friendUsername parameter is required.' });
        }

        const userQuery = `
            SELECT user_id
            FROM users
            WHERE username = ?
            LIMIT 1
        `;
        const userParams = [friendUsername];
        const userResult = await queryDatabase(userQuery, userParams);

        if (!userResult[0] || userResult[0].length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }
        const friendId = userResult[0][0].user_id;
        
        if (friendId === req.session.user_id) {
            return res.status(400).send({ error: 'You cannot remove yourself as a friend.' });
        }

        const checkQuery = `
            SELECT *
            FROM friends
            WHERE follower = ? AND followed = ?
        `;
        const checkParams = [req.session.user_id, friendId];
        const existing = await queryDatabase(checkQuery, checkParams);
        if (!existing[0] || existing[0].length === 0) {
            return res.status(400).send({ error: 'Friend relationship does not exist.' });
        }

        // Delete the friend relationship.
        const deleteQuery = `
            DELETE FROM friends
            WHERE follower = ? AND followed = ?
        `;
        let deleteParams = [req.session.user_id, friendId];
        await queryDatabase(deleteQuery, deleteParams);

        deleteParams = [friendId, req.session.user_id];
        await queryDatabase(deleteQuery, deleteParams);

        res.status(200).send({ message: 'Friend removed successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Error removing friend from the database.' });
    }
}


export {
    getFriends,
    getFriendRecs, 
    addFriend, 
    removeFriend
}