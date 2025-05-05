import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';

// Database connection setup
const db = get_db_connection();

var helper = new RouteHelper();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

async function sendChatInvite(req, res) {
    const senderId = req.session.user_id;
    const receiverId = req.body.receiverId;
    const roomId = req.body.roomId || null;
    
    if (!senderId || !receiverId) {
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else if (!helper.isLoggedIn(req, req.session.user_id)) {
        console.log(req.session);
        res.status(403).send({error: 'Not logged in.'});
    } else {
        try {
            // If roomId is provided, this is a group chat invite
            if (roomId) {
                // Check if sender is in room
                const [senderMember] = await queryDatabase(
                    `SELECT 1 FROM chat_members WHERE room_id = ? AND user_id = ?`,
                    [roomId, senderId]
                );
                
                if (senderMember.length === 0) {
                    res.status(403).send({error: 'You are not a member of this chat room.'});
                    return;
                }
                
                // Check if receiver is already in the room
                const [receiverMember] = await queryDatabase(
                    `SELECT 1 FROM chat_members WHERE room_id = ? AND user_id = ?`,
                    [roomId, receiverId]
                );
                
                if (receiverMember.length > 0) {
                    res.status(400).send({error: 'User is already a member of this chat room.'});
                    return;
                }
                
                // Check if adding user would create duplicate group chat
                // Get all members of room first
                const [currentMembers] = await queryDatabase(
                    `SELECT user_id FROM chat_members WHERE room_id = ?`,
                    [roomId]
                );
                
                const memberIds = currentMembers.map(member => member.user_id);
                // potential new set of members to check for duplicates
                const potentialMemberIds = [...memberIds, receiverId];
                
                // Check if potential members exactly exists, by finding chat rooms with members, checking count, and excluding current room
                const [duplicateRoomCheck] = await queryDatabase(`
                    SELECT r.room_id
                    FROM chat_rooms AS r
                    WHERE (
                        SELECT COUNT(DISTINCT cm.user_id) 
                        FROM chat_members AS cm 
                        WHERE cm.room_id = r.room_id
                    ) = ?
                    AND NOT EXISTS (
                        SELECT 1 
                        FROM chat_members AS cm 
                        WHERE cm.room_id = r.room_id 
                        AND cm.user_id NOT IN (${potentialMemberIds.join(',')})
                    )
                    AND (
                        SELECT COUNT(DISTINCT cm.user_id) 
                        FROM chat_members AS cm 
                        WHERE cm.room_id = r.room_id 
                        AND cm.user_id IN (${potentialMemberIds.join(',')})
                    ) = ?
                `, [potentialMemberIds.length, potentialMemberIds.length]);
                
                if (duplicateRoomCheck.length > 0) {
                    res.status(400).send({error: 'A group chat with exactly these members already exists.'});
                    return;
                }
                
                // Insert the invite with room_id if it is valid
                await queryDatabase(
                    `INSERT INTO chat_invites (sender_id, receiver_id, room_id) VALUES (?, ?, ?)`,
                    [senderId, receiverId, roomId]
                );
                
                res.status(200).send({message: 'Invite sent.'});
            } else {
                // Regular 1-on-1 case, check if they are already in a chat together
                const [existingChat] = await queryDatabase(`
                    SELECT r.room_id
                    FROM chat_rooms r
                    JOIN chat_members cm1 ON r.room_id = cm1.room_id
                    JOIN chat_members cm2 ON r.room_id = cm2.room_id
                    WHERE cm1.user_id = ? AND cm2.user_id = ?
                    AND (SELECT COUNT(*) FROM chat_members WHERE room_id = r.room_id) = 2
                `, [senderId, receiverId]);
                
                if (existingChat.length > 0) {
                    res.status(400).send({error: 'You already have a chat with this user.'});
                    return;
                }
                
                // Insert the invite without room_id (null)
                await queryDatabase(
                    `INSERT INTO chat_invites (sender_id, receiver_id, room_id) VALUES (?, ?, NULL)`,
                    [senderId, receiverId]
                );
                
                res.status(200).send({message: 'Chat invite sent.'});
            }
        } catch (error) {
            console.error('Error sending chat invite:', error);
            res.status(500).send({error: 'Error querying database'});
        }
    }
}

async function acceptChatInvite(req, res) {
    const currentUserId = req.session.user_id;
    const originalSenderId = req.body.senderIdFromInvite;
    
    console.log('Accepting chat invite - current user:', currentUserId, 'original sender:', originalSenderId);
    
    if (!currentUserId || !originalSenderId) {
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else {
        try {
            // Get invite
            const [inviteResult] = await queryDatabase(
                `SELECT * FROM chat_invites WHERE sender_id = ? AND receiver_id = ?`,
                [originalSenderId, currentUserId]
            );
            
            if (inviteResult.length === 0) {
                res.status(404).send({error: 'Chat invite not found.'});
                return;
            }
            
            const invite = inviteResult[0];
            let roomId = invite.room_id;
            
            console.log('Found invite with room ID:', roomId);
            
            // If room_id is null, this is a new chat invite
            if (roomId === null) {
                console.log('Creating new chat room.');
                // Get sender's username for chat name
                const [senderInfo] = await queryDatabase(
                    `SELECT username FROM users WHERE user_id = ?`,
                    [originalSenderId]
                );
                
                const senderUsername = senderInfo[0]?.username || 'User';
                
                // Create a new chat room
                const [roomResult] = await queryDatabase(
                    `INSERT INTO chat_rooms (room_name, is_group_chat) VALUES (?, ?)`,
                    [`Chat with ${senderUsername}`, false]
                );
                
                roomId = roomResult.insertId;
                console.log('Created new room with ID:', roomId);
                
                // Add both users to the chat room
                await queryDatabase(
                    `INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)`,
                    [roomId, currentUserId]
                );
                
                await queryDatabase(
                    `INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)`,
                    [roomId, originalSenderId]
                );
                
                console.log('Added both users to the new room');
            } else {
                // This is a group chat invite - just add the current user to the existing room
                console.log('Adding user to existing group chat:', roomId);
                
                // Check if user is already in this room (prevent duplicates)
                const [memberCheck] = await queryDatabase(
                    `SELECT 1 FROM chat_members WHERE room_id = ? AND user_id = ?`,
                    [roomId, currentUserId]
                );
                
                if (memberCheck.length === 0) {
                    await queryDatabase(
                        `INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)`,
                        [roomId, currentUserId]
                    );
                    console.log('User added to existing room');
                } else {
                    console.log('User was already a member of this room');
                }
            }
            
            // Remove the invite
            await queryDatabase(
                `DELETE FROM chat_invites WHERE sender_id = ? AND receiver_id = ?`,
                [originalSenderId, currentUserId]
            );
            
            res.status(200).send({message: 'Chat invite accepted.', roomId});
        } catch (error) {
            console.error('Error accepting chat invite:', error);
            res.status(500).send({error: 'Error querying database'});
        }
    }
}

async function getUserProfile(req, res) {
    const username = req.params.username;
    
    if (!helper.isLoggedIn(req, username)) {
      res.status(403).send({error: 'Not logged in.'});
    } else {
      try {
        const query = `
          SELECT user_id, username, first_name, last_name, email, 
                 affiliation, birthday, profile_photo, selfie_photo, linked_nconst
          FROM users 
          WHERE username = ?
        `;
        const params = [username];
        const [result] = await queryDatabase(query, params);
        
        if (result.length > 0) {
          res.status(200).send(result[0]);
        } else {
          res.status(404).send({error: 'User not found.'});
        }
      } catch (error) {
        res.status(500).send({error: 'Error querying database'});
      }
    }
  }
  
  async function getUserChats(req, res) {
    const user_id = req.session.user_id;
    
    if (!helper.isLoggedIn(req, user_id)) {
      res.status(403).send({error: 'Not logged in.'});
    } else {
      try {
        // Get all chat rooms user is in
        const roomsQuery = `
          SELECT r.room_id, r.room_name, r.is_group_chat
          FROM chat_rooms AS r
          JOIN chat_members AS cm ON r.room_id = cm.room_id
          WHERE cm.user_id = ?
        `;
        const rooms = await queryDatabase(roomsQuery, [user_id]);
        
        // Get members and latest message for each room
        const finalResult = [];
        
        for (const room of rooms[0]) {
          // Get other members of the room
          const membersQuery = `
            SELECT u.user_id, u.username
            FROM chat_members AS cm
            JOIN users AS u ON cm.user_id = u.user_id
            WHERE cm.room_id = ? AND u.user_id != ?
          `;
          const [members] = await queryDatabase(membersQuery, [room.room_id, user_id]);
          
          // Get the latest message
          const lastMessageQuery = `
            SELECT m.message_id, m.sender_id, u.username as sender_name, m.content, m.timestamp
            FROM chat_messages AS m
            JOIN users AS u ON m.sender_id = u.user_id
            WHERE m.room_id = ?
            ORDER BY m.timestamp DESC
            LIMIT 1
          `;
          const [lastMessages] = await queryDatabase(lastMessageQuery, [room.room_id]);
          
          // return room with members and last message
          finalResult.push({
            room_id: room.room_id,
            room_name: room.room_name,
            is_group_chat: room.is_group_chat,
            members: members,
            lastMessage: lastMessages.length > 0 ? lastMessages[0] : null
          });
        }
        
        res.status(200).send(finalResult);
      } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).send({error: 'Error querying database'});
      }
    }
  }
  
  // Get messages for a chat room
  async function getChatMessages(req, res) {
    const username = req.params.username;
    const roomId = parseInt(req.params.roomId, 10);
    
    if (!helper.isLoggedIn(req, username)) {
      res.status(403).send({error: 'Not logged in.'});
    } else {
      try {
        // Check if user is a member of this room
        const memberQuery = `
          SELECT 1 FROM chat_members AS cm
          JOIN users AS u ON cm.user_id = u.user_id
          WHERE u.username = ? AND cm.room_id = ?
        `;
        const [memberCheck] = await queryDatabase(memberQuery, [username, roomId]);
        
        if (memberCheck.length === 0) {
          res.status(403).send({error: 'Not a member of this chat room.'});
          return;
        }
        
        // Get messages
        const query = `
          SELECT m.message_id, m.sender_id, u.username as sender_name, m.content, m.timestamp
          FROM chat_messages AS m
          JOIN users AS u ON m.sender_id = u.user_id
          WHERE m.room_id = ?
          ORDER BY m.timestamp ASC
        `;
        const [messages] = await queryDatabase(query, [roomId]);
        
        res.status(200).send(messages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send({error: 'Error querying database'});
      }
    }
  }

// get friends who are online (their user_ids)
async function getUserFriends(req, res) {    
    console.log('Getting user friends for ' + req.session.user_id);
    try {
        if(!helper.isLoggedIn(req, req.session.user_id)) {
            res.status(403).send({error: 'Not logged in.'});
        } else {
            const query = `
            SELECT u2.username, u2.user_id FROM friends
            JOIN users AS u1 ON u1.user_id = friends.follower
            JOIN users AS u2 ON u2.user_id = friends.followed
            JOIN online_users AS ou ON ou.user_id = u2.user_id
            WHERE u1.user_id = ?
            `;

            const params = [req.session.user_id];
            const result = await queryDatabase(query, params);
            const fixed_result = result[0].map(row => ({
                followed: row.username,
                primaryName: row.username,
                user_id: row.user_id
            }));
            res.status(200).send({results: fixed_result});
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({error: 'Error querying database'});
    }
}

async function leaveChat(req, res) {
  const userId = req.session.user_id;
  const { roomId } = req.body;
  
  if (!userId || !roomId) {
    res.status(400).send({error: 'Missing required parameters'});
    return;
  }
  
  try {
    // Remove the user from the chat members
    await queryDatabase(
      `DELETE FROM chat_members WHERE room_id = ? AND user_id = ?`,
      [roomId, userId]
    );
    
    // Check if the chat is now empty
    const [countResult] = await queryDatabase(
      `SELECT COUNT(*) as count FROM chat_members WHERE room_id = ?`,
      [roomId]
    );
    
    if (countResult[0].count === 0) {
      // No members left - delete chat and messages
      await queryDatabase(`DELETE FROM chat_messages WHERE room_id = ?`, [roomId]);
      await queryDatabase(`DELETE FROM chat_rooms WHERE room_id = ?`, [roomId]);
    }
    
    res.status(200).send({message: 'Successfully left the chat'});
  } catch (error) {
    console.error('Error leaving chat:', error);
    res.status(500).send({error: 'Failed to leave chat'});
  }
}

async function checkGroupValidity(req, res) {
    const senderId = req.session.user_id;
    const receiverId = req.body.receiverId;
    const roomId = req.body.roomId;
    console.log('Checking group validity for senderId:', senderId, 'receiverId:', receiverId, 'roomId:', roomId);
    
    if (!senderId || !receiverId) {
        return res.status(400).send({error: 'Missing required parameters'});
    }
    
    try {
        // Prevent self invite
        if (senderId === receiverId) {
            return res.status(200).send({
                isValid: false,
                message: 'You cannot invite yourself to a chat.'
            });
        }
        
        // For 1-on-1 chats (no roomId)
        if (!roomId) {
            // Check if chat between two users
            const [existingChat] = await queryDatabase(`
                SELECT r.room_id
                FROM chat_rooms AS r
                JOIN chat_members AS cm1 ON r.room_id = cm1.room_id
                JOIN chat_members AS cm2 ON r.room_id = cm2.room_id
                WHERE cm1.user_id = ? AND cm2.user_id = ?
                AND (SELECT COUNT(*) FROM chat_members WHERE room_id = r.room_id) = 2
            `, [senderId, receiverId]);
            console.log(existingChat, 'existingChat');
            if (existingChat.length > 0) {
                return res.status(200).send({
                    isValid: false,
                    message: 'You already have a chat with this user.'
                });
            }
        } else {
            // For group chats, check if receiver is already in the room
            const [receiverMember] = await queryDatabase(
                `SELECT 1 FROM chat_members WHERE room_id = ? AND user_id = ?`,
                [roomId, receiverId]
            );
            
            if (receiverMember.length > 0) {
                return res.status(200).send({
                    isValid: false,
                    message: 'This user is already a member of this chat room.'
                });
            }
            
            // Get members in room
            const [currentMembers] = await queryDatabase(
                `SELECT user_id FROM chat_members WHERE room_id = ?`,
                [roomId]
            );
            
            const memberIds = currentMembers.map(member => member.user_id);
            
            // Make sure sender is a member
            if (!memberIds.includes(senderId)) {
                return res.status(200).send({
                    isValid: false,
                    message: 'You are not a member of this chat room.'
                });
            }
            
            // Get potentials again
            const potentialMemberIds = [...memberIds, receiverId];
            
            // Check for duplicates
            const [duplicateRoomCheck] = await queryDatabase(`
                SELECT r.room_id
                FROM chat_rooms AS r
                WHERE (
                    SELECT COUNT(DISTINCT cm.user_id) 
                    FROM chat_members AS cm 
                    WHERE cm.room_id = r.room_id
                ) = ?
                AND NOT EXISTS (
                    SELECT 1 
                    FROM chat_members AS cm 
                    WHERE cm.room_id = r.room_id 
                    AND cm.user_id NOT IN (${potentialMemberIds.join(',')})
                )
                AND (
                    SELECT COUNT(DISTINCT cm.user_id) 
                    FROM chat_members AS cm 
                    WHERE cm.room_id = r.room_id 
                    AND cm.user_id IN (${potentialMemberIds.join(',')})
                ) = ?
            `, [potentialMemberIds.length, potentialMemberIds.length]);
            
            if (duplicateRoomCheck.length > 0) {
                return res.status(200).send({
                    isValid: false,
                    message: 'A chat with exactly these members already exists.'
                });
            }
        }
        
        return res.status(200).send({
            isValid: true,
            message: 'Invitation is valid'
        });
    } catch (error) {
        console.error('Error checking group validity:', error);
        return res.status(500).send({error: 'Server error checking group validity'});
    }
}

export {
    sendChatInvite,
    acceptChatInvite,
    getUserProfile,
    getUserChats,
    getChatMessages,
    getUserFriends,
    leaveChat,
    checkGroupValidity
};