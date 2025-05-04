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
      <aside className="w-56 bg-slate-100 p-4 flex flex-col">
        <div className="text-xl font-bold mb-6">
          Pennstagram
          <div className="text-sm font-normal">@{username}</div>
        </div>

        <button
          type="button"
          className="px-2 py-2 mb-2 rounded-md bg-gray-500 outline-none text-white"
          onClick={friends}
        >
          Friends
        </button>
        <button
          type="button"
          className="px-2 py-2 mb-2 rounded-md bg-gray-500 outline-none text-white"
          onClick={chat}
        >
          Chat
        </button>
        <button
          type="button"
          className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
          onClick={chatMode}
        >
          ChatMode
        </button>
      </aside>
        <div className='flex-1 flex flex-col'>
          {/* <CreatePostComponent updatePosts={fetchData} /> */ }
          <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm">
          <span className="text-2xl font-medium">Feed</span>
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
    </div>
  )
}

