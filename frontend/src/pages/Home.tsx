import {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import PostComponent from '../components/PostComponent'
import CreatePostComponent from '../components/CreatePostComponent';
import { useNavigate } from 'react-router-dom';
import { FiHome, FiMessageCircle, FiSearch, FiUsers } from "react-icons/fi";
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

    const chatMode = () => {
      navigate("/"+ username+"/chatMode");
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

  const onLike = async (postId: number) => {
      try {
        const response = await axios.post(`${rootURL}/${username}/like`, { post_id: postId }, { withCredentials: true });
        if (response.status === 201) {
          console.log('Post liked successfully');
          fetchData(); // Refresh the posts after liking
        } else {
          console.error('Error liking post:', response.statusText);
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    };

  const onComment = async (postId: number, parentId: number, comment: string) => {
      try {
        console.log('Comment:', comment);
        console.log('Post ID:', postId);
        console.log('Parent ID:', parentId)
        const response = await axios.post(`${rootURL}/${username}/comment`, { post_id: postId, parent_id: parentId, text_content: comment }, { withCredentials: true });
        if (response.status === 201) {
          console.log('Comment added successfully');
          fetchData(); // Refresh the posts after commenting
        } else {
          console.error('Error adding comment:', response.statusText);
        }
      } catch (error) {
        console.error('Error adding comment:', error);
      }
    };


    useEffect(() => {
      fetchData();
    }, []);


  return (
    <div className='w-screen h-screen flex'>
      {/* Sidebar */}
      <aside className="w-24 bg-white p-4 flex flex-col items-center border-r">
          <div className="mb-6">
          <span className="text-3xl font-black tracking-tight">Insta</span>
          </div>

          <button
          type="button"
          onClick={friends}
          className="mb-6 p-2 hover:bg-gray-100 rounded-lg flex flex-col items-center"
          >
          <FiUsers size={24} />
          <span className="text-xs mt-1">Friends</span>
          </button>

          <button
          type="button"
          onClick={chatMode}
          className="mb-6 p-2 hover:bg-gray-100 rounded-lg flex flex-col items-center"
          >
          <FiMessageCircle size={24} />
          <span className="text-xs mt-1">Chat</span>
          </button>

          <button
          type="button"
          onClick={chat}
          className="p-2 hover:bg-gray-100 rounded-lg flex flex-col items-center"
          >
          <FiSearch size={24} />
          <span className="text-xs mt-1">Search</span>
          </button>
      </aside>
        <div className='flex-1 flex flex-col'>
          {/* <CreatePostComponent updatePosts={fetchData} /> */ }
          <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm">
          <span className="text-2xl font-medium">{`Feed (@${username})`}</span>
          </header>

          <div className="flex-1 overflow-y-auto mx-auto w-full max-w-[600px] flex flex-col items-center space-y-4 p-4">
          {
            // CUT HERE
            posts.map(p => <PostComponent onLike={() => onLike(p['post_id'])} user={p['username']} text={p['text_content']} 
            hashtags={p['hashtags']} likes={p['likes']} comments={p['comments']} key={p['post_id']} weight={[p['weight']]}
            onComment={(parent_id, comment)=>onComment(p['post_id'], parent_id, comment)} imageUrl={p['image_url']}/>)
            // END CUT
          }
          </div>
        </div>

        <aside className="w-80 bg-gray-50 border-l p-4 flex-shrink-0 h-full overflow-y-auto">
        <CreatePostComponent updatePosts={fetchData} />
      </aside>
    </div>
  )
}

