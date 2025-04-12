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
    // END CUT

    const feed = () => {
        navigate('/' + username + '/home');
    };
    const chat = () => {
        navigate("/"+ username+"/chat");
    };
  
    useEffect(() => {
        const fetchData = async () => {
            // CUT HERE
            console.log('fetching data');
            try {
                const friendRes = await axios.get(`${rootURL}/${username}/friends`, { withCredentials: true });
                const recRes = await axios.get(`${rootURL}/${username}/recommendations`, { withCredentials: true });
                
                setFriends(friendRes.data.results);
                setRecs(recRes.data.results);
                console.log(recRes.data);
            } catch (error) {
                console.error('Error fetching data:', error);
                navigate("/");
            }
            // END CUT
        };

        fetchData();
        
    }, []);
    

  return (
    <div>
        <div className='w-full h-16 bg-slate-50 flex justify-center mb-2'>
            <div className='text-2xl max-w-[1800px] w-full flex items-center'>
            Pennstagram - {username} &nbsp;
            <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={feed}>Feed</button>&nbsp;
            <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chat}>Chat</button>
            </div>
        </div>
        <div className='h-full w-full mx-auto max-w-[1800px] flex space-x-4 p-3'>
            <div className='font-bold text-2xl'>
                { `${ username }'s friends` }
                <div className='space-y-2'>
                    {
                        // CUT HERE
                        friends.map(f => <FriendComponent name={f['primaryName']} add={false} remove={true} key={f['followed']}/>)
                        // END CUT
                    }
                </div>
            </div>
            <div className='font-bold text-2xl'>
                { `${ username }'s recommended friends` }
                <div className='space-y-2'>
                    {
                        // CUT HERE
                        recs.map(r => <FriendComponent name={r['primaryName']} add={true} remove={false} key={r['recommendation']}/>)
                        // END CUT
                    }
                </div>
            </div>
        </div>
    </div>
  )
}
