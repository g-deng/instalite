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
        if (response.status === 200) {
          console.log('Post liked successfully');
          fetchData(); // Refresh the posts after liking
        } else {
          console.error('Error liking post:', response.statusText);
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    };

  const onComment = async (postId: number, comment: string) => {
      try {
        console.log('Comment:', comment);
        console.log('Post ID:', postId);
        const response = await axios.post(`${rootURL}/${username}/comment`, { post_id: postId, text_content: comment }, { withCredentials: true });
        if (response.status === 200) {
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
    <div className='w-screen h-screen'>
        <div className='w-full h-16 bg-slate-50 flex justify-center mb-2'>
            <div className='text-2xl max-w-[1800px] w-full flex items-center'>
                Pennstagram - {username} &nbsp;
                <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={friends}>Friends</button>&nbsp;
                <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chat}>Chat</button>
                <button type="button" className='px-2 py-2 rounded-md bg-gray-500 outline-none text-white'
              onClick={chatMode}>ChatMode</button>

            </div>
        </div>
        
        <div className='h-full w-full mx-auto max-w-[1800px] flex flex-col items-center space-y-4'>
          <CreatePostComponent updatePosts={fetchData} />
          {
            // CUT HERE
            posts.map(p => <PostComponent onLike={() => onLike(Number(p['post_id']))} user={p['username']} text={p['text_content']} 
            hashtags={p['hashtags']} likes={p['likes']} comments={p['comments']} key={p['post_id']} weight={[p['weight']]}
            onComment={(comment)=>onComment(Number(p['post_id']), comment)}/>)
            // END CUT
          }
        </div>
    </div>
  )
}

