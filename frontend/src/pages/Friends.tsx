import {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import { useNavigate } from 'react-router-dom';
import {getSocket} from '../Socket';
import { FiHome, FiMessageCircle, FiSearch, FiUsers, FiPlusSquare } from "react-icons/fi";
const FriendComponent = ({ name, add=true, remove=true , online=false}: { name: string, add: boolean|undefined, remove: boolean|undefined, online: boolean|undefined}) => {
    return (
        <div className='rounded-md bg-slate-100 p-3 flex space-x-2 items-center flex-auto justify-between'>
            <div className="flex items-center space-x-2">
                <span className="font-semibold text-base">{name}</span>
                <span
                    className={`inline-block w-3 h-3 rounded-full ${
                        online ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    aria-label={online ? 'Online' : 'Offline'}
                    title={online ? 'Online' : 'Offline'}
                />
            </div>
        </div>
    )
}

export default function Friends() {

    const navigate = useNavigate(); 
    const { username } = useParams();
    const rootURL = config.serverRootURL;

    // CUT HERE
    const [friends, setFriends] = useState([]); 
    const [recs, setRecs] = useState([]); 
    const [newFriend, setNewFriend] = useState('');
    const [removeFriend, setRemoveFriend] = useState('');

    const [online, setOnline]    = useState<string[]>([]);
    // END CUT

    const feed = () => {
        navigate('/' + username + '/home');
    };

    const post = () => {
        navigate('/' + username + '/createPost');
    }

      const friendsPage = () => {
          navigate("/"+ username+"/friends");
      };
  
      const chat = () => {
        navigate("/"+ username+"/chat");
      };
  
      const chatMode = () => {
        navigate("/"+ username+"/chatMode");
      };
  
    const fetchData = async () => {
        console.log('fetching data');
        try {
          const friendRes = await axios.get(`${rootURL}/${username}/friends`, { withCredentials: true });
          const recRes = await axios.get(`${rootURL}/${username}/recommendations`, { withCredentials: true });
          const onlineUsers = await axios.get(`${rootURL}/${username}/onlineUsers`,     { withCredentials: true })
          
          setFriends(friendRes.data.results);
          setRecs(recRes.data.results);
          setOnline(onlineUsers.data.results);
        } catch (error) {
          console.error('Error fetching data:', error);
          navigate("/");
        }
      };
    
      useEffect(() => {
        const socket = getSocket();
        socket.on('onlineUsers', (list: string[]) => {
            setOnline(list);
          });

        socket.on('userOnline', (user: string) => {
            setOnline(current => Array.from(new Set([...current, user])));
        });
        socket.on('userOffline', (user: string) => {
            setOnline(current => current.filter(u => u !== user));
        });
        console.log(online);
        fetchData();
        return () => {
            socket.off();
        };
      }, []);
    

    const handleAddFriend = async () => {
        if (newFriend.trim() === "") {
          alert("Please enter a friend username.");
          return;
        }
        try {
          // POST request to add the friend
          await axios.post(`${rootURL}/${username}/addFriend`, { friendUsername: newFriend }, { withCredentials: true });
          alert("Friend added successfully!");
          setNewFriend("");  
          fetchData();         
        } catch (error) {
          console.error("Error adding friend:", error);
          alert("Error adding friend. Please try again.");
        }
      };

    const handleRemoveFriend = async () => {
    if (removeFriend.trim() === "") {
        alert("Please enter a friend username.");
        return;
    }
    try {
        await axios.post(`${rootURL}/${username}/removeFriend`, { friendUsername: removeFriend }, { withCredentials: true });
        alert("Friend removed successfully!");
        setRemoveFriend("");  // Clear the input field.
        fetchData();         // Refresh the friend list.
    } catch (error) {
        console.error("Error removing friend:", error);
        alert("Error removing friend. Please try again.");
    }
    };


    return (
        <div className="w-screen h-screen flex bg-gray-50">
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
            onClick={friendsPage}
            className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
                'bg-gray-100'
            }`}
            >
            <FiUsers size={24} />
            <span className="text-xs mt-1">Friends</span>
            </button>

            <button
            type="button"
            onClick={chatMode}
            className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
                'hover:bg-gray-100'
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
            </aside>
    
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm">
          <span className="text-2xl font-medium">Friends</span>
        </header>

        <div className="flex-1 overflow-y-auto mx-auto w-full max-w-[1200px] flex flex-row space-x-6 p-4">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-xl font-semibold mb-3">
              {`${username}'s Friends`}
            </h2>
            <div className="space-y-2">
              {friends.map((f) => (
                <FriendComponent
                  key={f.followed}
                  name={f.username}
                  add={false}
                  remove={true}
                  online={online.includes(f.user_id)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-xl font-semibold mb-3">
              {`${username}'s Recommended Friends`}
            </h2>
            <div className="space-y-2">
              {recs.map((r) => (
                <FriendComponent
                  key={r.recommendation}
                  name={r.username}
                  add={true}
                  remove={false}
                  online={online.includes(r.user_id)}
                />
              ))}
            </div>
          </div>

          <div className="w-80 flex flex-col space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <h2 className="text-xl font-semibold mb-3">Add a Friend</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Enter username"
                  value={newFriend}
                  onChange={(e) => setNewFriend(e.target.value)}
                  className="border p-2 rounded flex-1"
                />
                <button
                  onClick={handleAddFriend}
                  className="px-3 py-2 bg-blue-500 text-white rounded"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <h2 className="text-xl font-semibold mb-3">Remove a Friend</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Enter username"
                  value={removeFriend}
                  onChange={(e) => setRemoveFriend(e.target.value)}
                  className="border p-2 rounded flex-1"
                />
                <button
                  onClick={handleRemoveFriend}
                  className="px-3 py-2 bg-red-500 text-white rounded"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
        </div>
      );
}
