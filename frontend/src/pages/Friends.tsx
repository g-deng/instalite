import {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import { useNavigate } from 'react-router-dom';

const FriendComponent = ({ name, add=true, remove=true }: { name: string, add: boolean|undefined, remove: boolean|undefined}) => {
    return (
        <div className='rounded-md bg-slate-100 p-3 flex space-x-2 items-center flex-auto justify-between'>
            <div className='font-semibold text-base'>
                { name }
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
    // END CUT

    const feed = () => {
        navigate('/' + username + '/home');
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
          
          setFriends(friendRes.data.results);
          setRecs(recRes.data.results);
        } catch (error) {
          console.error('Error fetching data:', error);
          navigate("/");
        }
      };
    
      useEffect(() => {
        fetchData();
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
    <div>
        <div className='w-full h-16 bg-slate-50 flex justify-center mb-2'>
            <div className='text-2xl max-w-[1800px] w-full flex items-center'>
            Pennstagram - {username} &nbsp;
            <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={feed}>Feed</button>&nbsp;
            <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chat}>Chat</button>
              <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chatMode}>ChatMode</button>
            </div>
        </div>
        <div className='h-full w-full mx-auto max-w-[1800px] flex space-x-4 p-3'>
            <div className='font-bold text-2xl'>
                { `${ username }'s friends` }
                <div className='space-y-2'>
                    {
                        // CUT HERE
                        friends.map(f => <FriendComponent name={f['username']} add={false} remove={true} key={f['followed']}/>)
                        // END CUT
                    }
                </div>
            </div>
            <div className='font-bold text-2xl'>
                { `${ username }'s recommended friends` }
                <div className='space-y-2'>
                    {
                        // CUT HERE
                        recs.map(r => <FriendComponent name={r['username']} add={true} remove={false} key={r['recommendation']}/>)
                        // END CUT
                    }
                </div>
            </div>
            {/* adding friend */}
            <div className='mb-4'>
            <h2 className='text-2xl font-bold'>Add a Friend</h2>
            <input
                type="text"
                placeholder="Enter Friend Username"
                value={newFriend}
                onChange={(e) => setNewFriend(e.target.value)}
                className='border p-2 rounded mr-2'
            />
            <button 
                onClick={handleAddFriend} 
                className='px-3 py-2 bg-blue-500 text-white rounded'
            >
                Add Friend
            </button>
            </div>

            {/* remove friend */}
            <div className='mb-4'>
            <h2 className='text-2xl font-bold'>Remove a Friend</h2>
            <input
                type="text"
                placeholder="Enter Friend Username"
                value={removeFriend}
                onChange={(e) => setRemoveFriend(e.target.value)}
                className='border p-2 rounded mr-2'
            />
            <button 
                onClick={handleRemoveFriend} 
                className='px-3 py-2 bg-blue-500 text-white rounded'
            >
                Add Friend
            </button>
            </div>
        </div>
    </div>
  )
}
