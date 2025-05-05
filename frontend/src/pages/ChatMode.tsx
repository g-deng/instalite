import { useState, useEffect, useRef } from 'react'
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import config from '../../config.json';
import { io } from 'socket.io-client';
import { getSocket } from '../Socket';
import { FiHome, FiMessageCircle, FiSearch, FiUsers, FiPlusSquare, FiLogOut } from "react-icons/fi";

const MessageComponent = ({ sender, content, timestamp }: { sender: string, content: string, timestamp: string }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className='rounded-md bg-slate-100 p-3 mb-2'>
      <div className='flex justify-between mb-1'>
        <span className='font-semibold'>{sender}</span>
        <span className='text-xs text-gray-500'>{formatTime(timestamp)}</span>
      </div>
      <div>{content}</div>
    </div>
  )
}

export default function ChatMode() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [chatName, setChatName] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');
  //const [socket, setSocket] = useState<any>(null);
  const newSocket = useRef(getSocket()).current;
  const [userId, setUserId] = useState<number | null>(null);
  const [friendList, setFriendList] = useState<any[]>([]);
  const [showNewChatForm, setShowNewChatForm] = useState<boolean>(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showAddUsersForm, setShowAddUsersForm] = useState<boolean>(false);
  const activeChatRef = useRef<number | null>(null);

  const { username } = useParams();
  const navigate = useNavigate();
  const rootURL = config.serverRootURL;

  // Navigation functions
    const feed = () => {
      navigate('/' + username + '/home');
  };

  const post = () => {
    navigate('/' + username + '/createPost');
  }
    const friends = () => {
        navigate("/"+ username+"/friends");
    };

    const chat = () => {
      navigate("/"+ username+"/chat");
    };

    const chatMode = () => {
      navigate("/"+ username+"/chatMode");
    };

    const logout = async () => {
      await axios.post(`${rootURL}/logout`, { withCredentials: true });
      const sock = getSocket();
      sock.disconnect();
      navigate("/");
    }

  // Connect to socket when we go to this page
  useEffect(() => {
    //const newSocket = io('http://localhost:8080', { withCredentials: true });
    
    newSocket.on('connect', () => {
      console.log('Connected to socket server with ID:', newSocket.id);
    });

    newSocket.on('new_message', (message) => {
      console.log('Socket message received:', message);
      
      // Normalize socket message structure so it displays correctly on frontend
      const normalizedMessage = {
        message_id: message.message_id,
        sender_id: message.senderId,
        sender_name: message.username,
        content: message.content,
        timestamp: message.timestamp
      };
      
      if (activeChatRef.current !== null) {
        setMessages(prev => [...prev, normalizedMessage]);
      }
    });

    newSocket.on('chat_invite', (data) => {
      console.log('Received chat invite from user ID:', data.senderId);
      
      // pending invites (can maybe store this in database later at some point)
      setPendingInvites(prev => [...prev, {
        id: Date.now(),
        senderId: data.senderId,
        senderUsername: data.senderUsername
      }]);
    });

    //setSocket(newSocket);

    // Get current user ID
    axios.get(`${rootURL}/${username}/profile`, { withCredentials: true })
      .then(response => {
        setUserId(response.data.user_id);
        //newSocket.emit('user_connect', response.data.user_id);
        //console.log('Connected as user:', response.data.user_id);
      })
      .catch(error => {
        console.error('Error fetching user data:', error);
        navigate('/');
      });

    return () => {
      newSocket.off();
    };
  }, []);

  // Fetch user's chat rooms to display on the left
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await axios.get(`${rootURL}/${username}/chats`, { withCredentials: true });
        setChats(response.data);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };
    fetchChats();
  }, [username]);

  // When the current active chat changes, fetch new messages from that chat
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat);
      
      // find chat name
      const chat = chats.find(c => c.room_id === activeChat);
      if (chat) {
        setChatName(chat.is_group_chat ? chat.room_name : chat.members[0]?.username || 'Chat');
      }
      
      // join socket room
      if (newSocket) {
        newSocket.emit('join_room', activeChat);
      }
    }
  }, [activeChat]);

  const fetchMessages = async (roomId: number) => {
    try {
      const response = await axios.get(`${rootURL}/${username}/chats/${roomId}/messages`, 
        { withCredentials: true });
      
      console.log('Messages from API:', response.data);
      
      // Normalize message structure for frontend display
      const normalizedMessages = response.data.map(msg => ({
        message_id: msg.message_id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        content: msg.content,
        timestamp: msg.timestamp
      }));
      
      setMessages(normalizedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !activeChat || !newSocket || !userId) {
        return;
    }

    const message = {
      roomId: activeChat,
      senderId: userId,
      content: messageInput
    };

    newSocket.emit('send_message', message);
    setMessageInput('');
  };

  // Function to fetch friends who ARE ONLINE in order to invite to chats
  useEffect(() => {
    if (username) {
      axios.get(`${rootURL}/${username}/userFriends`, { withCredentials: true })
        .then(response => {
          setFriendList(response.data.results || []);
        })
        .catch(error => {
          console.error('Error fetching friends:', error);
        });
    }
  }, [username]);

  // sending chat invite to start 1-on-1 chat
  const sendChatInvite = (receiverId: number) => {
    if (!newSocket || !userId) return;

    console.log('Checking if 1-on-1 chat already exists');
    
    // Check for duplicate 1-on-1 chat
    axios.post(`${rootURL}/${username}/checkGroupValidity`, {
      receiverId: receiverId
      // No roomId means 1-on-1
    }, { withCredentials: true })
    .then(response => {
      if (!response.data.isValid) {
        alert(response.data.message);
      } else {
        console.log('Starting new chat with user:', receiverId);
        
        // For new chats, don't include roomId (should be null anyways)
        newSocket.emit('send_invite', {
          senderId: userId,
          receiverId: receiverId
          // No roomId indicates new chat
        });
        
        setShowNewChatForm(false);
        alert('Chat invitation sent!');
      }
    })
    .catch(error => {
      console.error('Error checking for duplicate chat:', error);
      alert('Error checking if you already have a chat with this user');
    });
  };

  // Invite to existing group chat
  const inviteUserToCurrentChat = (receiverId: number) => {
    if (!newSocket || !userId || !activeChat) {
      return;
    }

    console.log('Checking if invitation would create duplicate group.');
    
    // Check for duplicate group
    axios.post(`${rootURL}/${username}/checkGroupValidity`, {
      receiverId: receiverId,
      roomId: activeChat
    }, { withCredentials: true })
    .then(response => {
      if (!response.data.isValid) {
        alert(response.data.message);
      } else {
        console.log('Inviting to existing group chat. Room ID:', activeChat, 'User:', receiverId);
        
        newSocket.emit('send_invite', {
          senderId: userId,
          receiverId: receiverId,
          roomId: activeChat // add roomId here to indicate group
        });
        
        setShowAddUsersForm(false);
        alert('Group invitation sent!');
      }
    })
    .catch(error => {
      console.error('Error checking for duplicate group:', error);
      alert('Error checking if this would create a duplicate group chat');
    });
  };

  // Add a component to display pending invites
  const acceptInvite = (invite: any) => {
    axios.post(`${rootURL}/${username}/acceptChatInvite`, {
      senderIdFromInvite: invite.senderId 
    }, { withCredentials: true })
    .then(() => {
      // Remove from pending invites
      setPendingInvites(prev => prev.filter(item => item.id !== invite.id));
      // Refresh the chat list
      return axios.get(`${rootURL}/${username}/chats`, { withCredentials: true });
    })
    .then(response => {
      setChats(response.data);
    })
    .catch(error => {
      console.error('Error accepting chat invite:', error);
    });
  };

  const declineInvite = (inviteId: number) => {
    setPendingInvites(prev => prev.filter(item => item.id !== inviteId));
  };

  // Update the ref whenever activeChat changes
  useEffect(() => {
    activeChatRef.current = activeChat;
    console.log('Active chat changed to:', activeChat);
  }, [activeChat]);

  const leaveChat = (roomId: number) => {
    if (!newSocket || !userId) return;
    
    // confirming window
    if (window.confirm("Are you sure you want to leave this chat?")) {
      // Send socket event to leave the chat
      newSocket.emit('leave_chat', {
        userId: userId,
        roomId: roomId
      });
      
      // Update local state
      setActiveChat(null);
      setChatName('');
      setMessages([]);
      
      // Remove chat from list
      setChats(prevChats => prevChats.filter(chat => chat.room_id !== roomId));
    }
  };

  return (
    <div className='w-screen h-screen flex'>
      <aside className="w-24 bg-white p-4 flex flex-col items-center border-r">
    <div className="mb-6">
      <span className="text-3xl font-black tracking-tight">Insta</span>
    </div>

    <button
      type="button"
      onClick={feed}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'hover:bg-gray-100'
      }`}
    >
      <FiHome size={24} />
      <span className="text-xs mt-1">Home</span>
    </button>

    <button
      type="button"
      onClick={post}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'hover:bg-gray-100'
      }`}
    >
      <FiPlusSquare size={24} />
      <span className="text-xs mt-1">Post</span>
    </button>

    <button
      type="button"
      onClick={friends}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'hover:bg-gray-100'
      }`}
    >
      <FiUsers size={24} />
      <span className="text-xs mt-1">Friends</span>
    </button>

    <button
      type="button"
      onClick={chatMode}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
        'bg-gray-100'
      }`}
    >
      <FiMessageCircle size={24} />
      <span className="text-xs mt-1">Chat</span>
    </button>

    <button
      type="button"
      onClick={chat}
      className={`p-2 rounded-lg flex flex-col items-center ${
        'hover:bg-gray-100'
      }`}
    >
      <FiSearch size={24} />
      <span className="text-xs mt-1">Search</span>
    </button>

      <div className="mt-auto" />
      <button
        type="button"
        onClick={logout}
        className={`p-2 rounded-lg flex flex-col items-center ${
          'hover:bg-gray-100'
        }`}
      >
        <FiLogOut size={24} />
        <span className="text-xs mt-1">Logout</span>
      </button>
    </aside>
      
      <div className='h-[calc(100%-4rem)] w-full mx-auto max-w-[1800px] flex space-x-4 p-3'>
        {/* Chat List */}
        <div className='w-1/3'>
          <div className='flex justify-between items-center mb-4'>
            <div className='font-bold text-2xl'>Your Chats</div>
            <button 
              className='bg-blue-500 text-white px-3 py-1 rounded-md'
              onClick={() => {
                setShowNewChatForm(!showNewChatForm);
                setShowAddUsersForm(false);
              }}
            >
              + New Chat
            </button>
          </div>
          
          {/* New Chat Form */}
          {showNewChatForm && (
            <div className='mb-4 bg-gray-100 p-3 rounded-md'>
              <h3 className='font-semibold mb-2'>Start a new chat with:</h3>
              <div className='max-h-[200px] overflow-y-auto'>
                {friendList.length === 0 ? (
                  <p>No friends available</p>
                ) : (
                  friendList.map(friend => (
                    <div 
                      key={friend.followed}
                      className='p-2 hover:bg-blue-100 cursor-pointer flex justify-between'
                      onClick={() => sendChatInvite(friend.user_id)}
                    >
                      <span>{friend.primaryName}</span>
                      <button className='text-blue-500'>Start Chat</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <div className='space-y-2 max-h-[600px] overflow-y-auto'>
            {chats.length === 0 ? (
              <div className='text-gray-500'>No chats available</div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.room_id} 
                  className={`rounded-md p-3 cursor-pointer ${activeChat === chat.room_id ? 'bg-blue-100' : 'bg-slate-100'}`}
                  onClick={() => {
                    console.log('Setting active chat to:', chat.room_id);
                    setActiveChat(chat.room_id);
                  }}
                >
                  <div className='font-semibold'>
                    {chat.is_group_chat ? chat.room_name : chat.members[0]?.username || 'Chat'}
                  </div>
                  {chat.lastMessage && (
                    <div className='text-sm text-gray-500 truncate'>
                      {chat.lastMessage.sender_name}: {chat.lastMessage.content}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Chat Window */}
        <div className='w-2/3'>
          {activeChat ? (
            <>
              <div className='flex justify-between items-center mb-4'>
                <div className='font-bold text-2xl'>{chatName}</div>
                <button 
                  className='px-3 py-1 bg-red-500 text-white rounded-md'
                  onClick={() => leaveChat(activeChat)}
                >
                  Leave Chat
                </button>
                <button 
                  className='bg-green-500 text-white px-3 py-1 rounded-md'
                  onClick={() => {
                    setShowAddUsersForm(!showAddUsersForm);
                    setShowNewChatForm(false);
                  }}
                >
                  + Add to Group
                </button>
              </div>
              
              {/* Form to add users to the current chat */}
              {showAddUsersForm && (
                <div className='mb-4 bg-gray-100 p-3 rounded-md'>
                  <h3 className='font-semibold mb-2'>Add users to this group chat:</h3>
                  <div className='max-h-[200px] overflow-y-auto'>
                    {friendList.length === 0 ? (
                      <p>No friends available</p>
                    ) : (
                      friendList.map(friend => (
                        <div 
                          key={friend.followed}
                          className='p-2 hover:bg-blue-100 cursor-pointer flex justify-between'
                          onClick={() => inviteUserToCurrentChat(friend.user_id)}
                        >
                          <span>{friend.primaryName}</span>
                          <button className='text-green-500'>Add to Group</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              <div className='bg-white rounded-md p-4 h-[500px] flex flex-col'>
                <div className='flex-1 overflow-y-auto mb-4'>
                  {messages.length === 0 ? (
                    <div className='text-center text-gray-500'>No messages yet</div>
                  ) : (
                    messages.map(msg => (
                      <MessageComponent 
                        key={msg.message_id}
                        sender={msg.sender_name}
                        content={msg.content}
                        timestamp={msg.timestamp}
                      />
                    ))
                  )}
                </div>
                <div className='flex'>
                  <input 
                    type='text'
                    placeholder='Type a message...'
                    className='flex-1 px-3 py-2 border rounded-l-md outline-none'
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        sendMessage();
                      }
                    }}
                  />
                  <button 
                    className='bg-blue-500 text-white px-4 py-2 rounded-r-md'
                    onClick={sendMessage}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className='flex items-center justify-center h-[500px] bg-white rounded-md'>
              <p className='text-gray-500'>Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          {pendingInvites.map(invite => (
            <div key={invite.id} className="bg-white p-4 rounded-md shadow-md mb-2 border border-gray-200">
              <div className="mb-2">{invite.senderUsername} invited you to chat</div>
              <div className="flex gap-2">
                <button 
                  className="bg-green-500 text-white px-3 py-1 rounded"
                  onClick={() => acceptInvite(invite)}
                >
                  Accept
                </button>
                <button 
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => declineInvite(invite.id)}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}