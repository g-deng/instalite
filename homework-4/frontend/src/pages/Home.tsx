import {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import PostComponent from '../components/PostComponent'
import CreatePostComponent from '../components/CreatePostComponent';
import { useNavigate } from 'react-router-dom';

export default function Home() {

    const { username } = useParams();
    const rootURL = config.serverRootURL;
    // CUT HERE
    const [posts, setPosts] = useState([]); 
    // END CUT
    const navigate = useNavigate(); 

    const friends = () => {
        navigate("/"+ username+"/friends");
    };

    const chat = () => {
      navigate("/"+ username+"/chat");
    };

  const fetchData = async () => {
      // CUT HERE
      try {
        const response = await axios.get(`${rootURL}/${username}/feed`, { withCredentials: true });
        setPosts(response.data.results);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      // END CUT
    };
  
    useEffect(() => {
      fetchData();
    }, []);


  return (
    <div className='w-screen h-screen'>
        <div className='w-full h-16 bg-slate-50 flex justify-center mb-2'>
            <div className='text-2xl max-w-[1800px] w-full flex items-center'>
                Pennstagram - {username} &nbsp;
                <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={friends}>Friends</button>&nbsp;
                <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chat}>Chat</button>

            </div>
        </div>
        
        <div className='h-full w-full mx-auto max-w-[1800px] flex flex-col items-center space-y-4'>
          <CreatePostComponent updatePosts={fetchData} />
          {
            // CUT HERE
            posts.map(p => <PostComponent title={p['title']} user={p['username']} description={p['content']} key={p['post_id']}/>)
            // END CUT
          }
        </div>
    </div>
  )
}

